package server

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// Run the actual Node producer with an offline transport. Synthetic MPEG frames
// prove the production/import contract, not intelligibility or listening quality.
func TestNarrationProducerV2ImportsIntoBackend(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal("Node is required for the narration producer/backend contract test")
	}
	tools, err := filepath.Abs("../../../../packages/content/tools")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	script := `
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [source, root] = process.argv.slice(1);
const destination = path.join(root, 'packages/content/tools');
await fs.mkdir(destination, {recursive:true});
await fs.copyFile(path.join(source,'produce-narration.mjs'), path.join(destination,'produce-narration.mjs'));
await fs.cp(path.join(source,'lib'), path.join(destination,'lib'), {recursive:true, filter:p=>!p.endsWith('.test.mjs')});
const packs = path.join(root,'packages/content/packs');
await fs.mkdir(packs, {recursive:true});
await fs.writeFile(path.join(packs,'ma-y1-contract.json'), JSON.stringify({
 pack_id:'ma-y1-contract', source_alignment:{year:1},
 question_variants:[
  {variant_id:'one', body:{audio_asset_id:'narration-contract', narration_script:'Choose 2 < 3 & 4 > 1.\u2028 A paragraph\u2029 and literal \\u2028 stay distinct.'}},
  {variant_id:'two', body:{phoneme_audio_asset_ids:['phoneme-sh']}}
 ]
}));
let requests=0;
globalThis.fetch=async(url, init)=>{
 if(!String(url).startsWith('https://api.elevenlabs.io/v1/text-to-speech/') || init.method!=='POST') throw new Error('unexpected transport');
 requests++;
 const audio=Buffer.alloc(417*8);
 for(let i=0;i<audio.length;i+=417)audio.set([0xff,0xfb,0x90,0],i);
 return new Response(audio,{status:200,headers:{'content-type':'audio/mpeg'}});
};
process.env.ELEVENLABS_API_KEY='offline-contract-only';
process.env.ELEVENLABS_VOICE_ID='Xb7hH8MSUJpSbSDYk0k2';
process.env.ELEVENLABS_MODEL_ID='eleven_multilingual_v2';
process.argv=[process.execPath,'produce-narration.mjs','--only','variants','--limit','1','--licence','provider_terms'];
await import(pathToFileURL(path.join(destination,'produce-narration.mjs')));
if(requests!==1)throw new Error('expected exactly one eligible production request');
`
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, node, "--input-type=module", "-e", script, tools, root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("offline producer: %v: %s", err, output)
	}
	body, err := os.ReadFile(filepath.Join(root, "packages/content/audio/narration-manifest-v2.json"))
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := decodeNarrationManifest(body)
	if err != nil {
		t.Fatalf("actual producer output must validate: %v", err)
	}
	if len(manifest.Assets) != 1 || manifest.Totals.SpecialistRequired != 1 {
		t.Fatal("producer inventory omitted assets or specialist blockers")
	}
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAudioOperationsRepository{fakeRepository: &fakeRepository{}}
	srv := New(repo, "postgres")
	request := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/manifests/import", bytes.NewReader(body))
	request.Header.Set("X-Admin-Key", "test-admin")
	request.Header.Set("Idempotency-Key", manifest.ReleaseID)
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)
	if response.Code != http.StatusCreated || len(repo.imports) != 1 {
		t.Fatalf("producer import: status=%d body=%s", response.Code, response.Body.String())
	}
}
