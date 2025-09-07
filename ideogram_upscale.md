Upscale
POST
https://api.ideogram.ai/upscale
POST
/upscale

TypeScript

const formData = new FormData();
formData.append('image_request', JSON.stringify({
  resemblance: 55,
  detail: 90
}));
formData.append('image_file', new Blob([fs.readFileSync("<file1>")], {
  type: 'image/png'
}));
const response = await fetch('https://api.ideogram.ai/upscale', {
  method: 'POST',
  headers: { 'Api-Key': '<apiKey>' },
  body: formData
});
const data = await response.json();
console.log(data);
Try it

200
Successful

{
  "created": "2000-01-23 04:56:07+00:00",
  "data": [
    {
      "prompt": "A photo of a cat",
      "resolution": "1280x800",
      "is_image_safe": true,
      "seed": 12345,
      "url": "https://ideogram.ai/api/images/ephemeral/xtdZiqPwRxqY1Y7NExFmzB.png?exp=1743867804&sig=e13e12677633f646d8531a153d20e2d3698dca9ee7661ee5ba4f3b64e7ec3f89",
      "style_type": "GENERAL"
    }
  ]
}
Upscale provided images synchronously with an optional prompt.

Supported image formats include JPEG, PNG, and WebP.

Images links are available for a limited period of time; if you would like to keep the image, you must download it.

Headers
Api-Key
string
Required
Request
This endpoint expects a multipart form containing a file.
image_request
object
Required
A request to upscale a provided image with the help of an optional prompt.

Hide 6 properties
prompt
string
Optional
An optional prompt to guide the upscale
resemblance
integer
Optional
>=1
<=100
Defaults to 50
detail
integer
Optional
>=1
<=100
Defaults to 50
magic_prompt_option
enum
Optional
Determine if MagicPrompt should be used in generating the request or not.
Allowed values:
AUTO
ON
OFF
num_images
integer
Optional
>=1
<=8
Defaults to 1
The number of images to generate.
seed
integer
Optional
>=0
<=2147483647
Random seed. Set for reproducible generation.
image_file
file
Required
An image binary (max size 10MB); only JPEG, WebP and PNG formats are supported at this time.

Response
Image(s) generated successfully.

created
datetime
The time the request was created.
data
list of objects
A list of ImageObjects that contain the generated image(s).


Hide 6 properties
prompt
string
The prompt used for the generation. This may be different from the original prompt.
resolution
string
The resolution of the final image.
is_image_safe
boolean
Whether this request passes safety checks. If false, the url field will be empty.
seed
integer
>=0
<=2147483647
Random seed. Set for reproducible generation.
url
string or null
format: "uri"
The direct link to the image generated.
style_type
enum or null
The style type to generate with; this is only applicable for models V_2 and above and should not be specified for model versions V_1.


Search...

AUTO
GENERAL
FICTION
REALISTIC
DESIGN
RENDER_3D
ANIME
Errors

400
Post Upscale Image Request Bad Request Error

403
Post Upscale Image Request Forbidden Error

422
Post Upscale Image Request Unprocessable Entity Error

429
Post Upscale Image Request Too Many Requests Error