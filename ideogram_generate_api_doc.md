Here’s a polished **Markdown API reference document** version of your request. I’ve optimized the formatting for readability and structured it like standard API docs.

---

# Image Generation API

This endpoint allows you to generate images by sending a **multipart form** with one or more files.

---

## **Endpoint**

```
POST https://api.ideogram.ai/v1/ideogram-v3/generate
```

---

## **Parameters**

### **prompt** (string, Required)

The prompt text to use for generating the image.

---

### **seed** (integer, Optional)

* Range: `0 – 2147483647`
* Random seed for reproducible results.

---

### **aspect\_ratio** (enum, Optional)

Determines the image resolution. Cannot be used with `resolution`.
Defaults to **1x1**.

Allowed values:

* 1x3
* 3x1
* 1x2
* 2x1
* 9x16
* 16x9
* 10x16
* 16x10
* 2x3
* 3x2
* 3x4
* 4x3
* 4x5
* 5x4 (default)
* 1x1

---

### **rendering\_speed** (enum, Optional)

Defaults to **DEFAULT**.

Allowed values:

* TURBO
* DEFAULT
* QUALITY (Default)

---

### **magic\_prompt** (enum, Optional)

Determines if MagicPrompt should assist in generating the request.

Allowed values:

* AUTO
* ON (Default)
* OFF

---

### **num\_images** (integer, Optional)

* Range: `1 – 8`
* Defaults to **1**.
* Example: To generate 4 images, set `num_images = 4`.

---

### **negative\_prompt** (string, Optional)

Text describing elements to **exclude** from the generated image.
⚠️ Descriptions in `prompt` take precedence over `negative_prompt`.

---

### **style\_type** (enum, Optional)

Controls the style of image generation. Defaults to **GENERAL**.

Allowed values:

* AUTO
* GENERAL
* REALISTIC
* DESIGN (Default)
* FICTION

---

### **style\_reference\_images** (files, Optional)

* Up to 10MB total.
* Formats: JPEG, PNG, WebP
* Multiple images allowed.

---

### **character\_reference\_images** (files, Optional)

* Up to 10MB total.
* Currently supports **only 1 character reference image**.
* Formats: JPEG, PNG, WebP
* Subject to character reference pricing.

---

### **character\_reference\_images\_mask** (files, Optional)

* Must match the number of `character_reference_images`.
* Each mask should be a grayscale image, same dimensions as the reference image.
* Formats: JPEG, PNG, WebP

---

## **Example Request**

```javascript
const formData = new FormData();
formData.append('prompt', 'A photo of a cat');
formData.append('rendering_speed', 'TURBO');

// Optional: Add style reference images
// formData.append('style_reference_images', '<style_reference_image_1>');
// formData.append('style_reference_images', '<style_reference_image_2>');

const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
  method: 'POST',
  headers: { 'Api-Key': '<apiKey>' },
  body: formData
});

const data = await response.json();
console.log(data);
```
// Curl example

curl -X POST https://api.ideogram.ai/v1/ideogram-v3/generate \
  -H "Api-Key: <apiKey>" \
  -H "Content-Type: multipart/form-data" \
  -F prompt="A photo of a cat sleeping on a couch." \
  -F rendering_speed="TURBO"



---

## **Successful Response**

```json
{
  "created": "2000-01-23 04:56:07+00:00",
  "data": [
    {
      "prompt": "A photo of a cat sleeping on a couch.",
      "resolution": "1024x1024",
      "is_image_safe": true,
      "seed": 12345,
      "url": "https://ideogram.ai/api/images/ephemeral/xtdZiqPwRxqY1Y7NExFmzB.png?exp=1743867804&sig=e13e12677633f646d8531a153d20e2d3698dca9ee7661ee5ba4f3b64e7ec3f89",
      "style_type": "GENERAL"
    }
  ]
}
```



---

Quick Reference Table
Parameter	Type	Required	Default	Allowed Values / Range
prompt	string	✅	—	Free text (image description)
seed	integer	❌	random	0 – 2147483647
aspect_ratio	enum	❌	1x1	1x3, 3x1, 1x2, 2x1, 9x16, 16x9, 10x16, 16x10, 2x3, 3x2, 3x4, 4x3, 4x5, 5x4, 1x1
rendering_speed	enum	❌	DEFAULT	TURBO, DEFAULT, QUALITY
magic_prompt	enum	❌	ON	AUTO, ON, OFF
num_images	integer	❌	1	1 – 8
negative_prompt	string	❌	—	Free text (exclusions)
style_type	enum	❌	GENERAL	AUTO, GENERAL, REALISTIC, DESIGN, FICTION
style_reference_images	files	❌	—	JPEG, PNG, WebP (≤ 10MB total)
character_reference_images	files	❌	—	JPEG, PNG, WebP (≤ 10MB total, only 1 image supported)
character_reference_images_mask	files	❌	—	JPEG, PNG, WebP (grayscale, must match # of character refs, same dimensions)
