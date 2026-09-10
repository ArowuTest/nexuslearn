// Package narrationjson serializes the fixed-key narration schemas consistently
// with the Node producer's sorted JSON.stringify payloads. It is not an HTML
// renderer and must not be used to interpolate JSON into an HTML script element.
package narrationjson

import (
	"bytes"
	"encoding/json"
)

func Marshal(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	body := bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
	result := make([]byte, 0, len(body))
	for i := 0; i < len(body); i++ {
		if body[i] == '\\' && i+1 < len(body) {
			// Walk escape pairs, so a literal backslash-u2028 remains literal.
			if i+5 < len(body) && (string(body[i:i+6]) == `\u2028` || string(body[i:i+6]) == `\u2029`) {
				if body[i+5] == '8' {
					result = append(result, []byte("\u2028")...)
				} else {
					result = append(result, []byte("\u2029")...)
				}
				i += 5
				continue
			}
			result = append(result, body[i], body[i+1])
			i++
			continue
		}
		result = append(result, body[i])
	}
	return result, nil
}
