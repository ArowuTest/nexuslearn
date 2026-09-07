import { expect, test } from "@playwright/test";

test("required answers stay disabled before and during delayed playback, then fail without saving", async ({ page }) => {
  await page.addInitScript(()=>{window.Audio=class {
    onended=null;onerror=null;preload="";
    play(){return new Promise<void>((_,reject)=>Object.assign(window,{failRequiredAudio:()=>reject(new Error("missing clip"))}));}
    pause(){}removeAttribute(){}load(){}
  } as unknown as typeof Audio;});
  const attempts:string[]=[];
  await page.route("http://api.test/**",route=>{
    if(route.request().url().includes("/v1/learning/mission"))return route.fulfill({json:{
      student_id:"audio-pupil",activity:{id:"audio-a",title:"Listen",interaction:{}},
      objective:{id:"audio-o",year:1,subject:"English"},world:{key:"wonder-garden",year_group:1,config:{}},
      runtime_adaptations:{animation_tier:"static",reduced_motion:true,question_limit:1},
      questions:[{id:"audio-q",question_version:"v1",objective_id:"audio-o",format:"number-input",response_kind:"number",body:{prompt:"Which number did you hear?",input:"number",audio_required:true,audio_url:"/missing-required.mp3"},hints:[]}],
    }});
    if(route.request().url().endsWith("/v1/learning/attempt"))attempts.push(route.request().postData()??"");
    return route.fulfill({status:404,json:{}});
  });
  await page.goto("/play/mission?studentId=audio-pupil&activityId=audio-a");
  const controls=page.getByRole("button",{name:"Keyboard answer",exact:true});
  await expect(controls).toBeDisabled();
  await page.getByRole("button",{name:"Hear question",exact:true}).click();
  await expect(controls).toBeDisabled();
  await page.evaluate(()=>{(window as unknown as {failRequiredAudio:()=>void}).failRequiredAudio();});
  await expect(page.getByRole("heading",{name:"Listening recording unavailable"})).toBeVisible();
  expect(attempts).toEqual([]);
});
