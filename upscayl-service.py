#!/usr/bin/env python3

print("Starting upscayl service...")

print("Testing imports...")
try:
    print("Importing flask...")
    from flask import Flask, request, send_file, jsonify
    print("Flask imported successfully")
except ImportError as e:
    print(f"Flask import error: {e}")
    exit(1)

try:
    print("Importing standard libraries...")
    import os
    import subprocess
    import tempfile
    import uuid
    import io
    print("Standard libraries imported successfully")
except ImportError as e:
    print(f"Standard library import error: {e}")
    exit(1)

try:
    print("Importing PIL...")
    from PIL import Image
    print("PIL imported successfully")
except ImportError as e:
    print(f"PIL import error: {e}")
    exit(1)

try:
    print("Importing rembg...")
    from rembg import remove
    print("rembg imported successfully")
except ImportError as e:
    print(f"rembg import error: {e}")
    print("Continuing without rembg...")
    remove = None
except Exception as e:
    print(f"rembg initialization error: {e}")
    print("Continuing without rembg...")
    remove = None

print("All imports successful")

app = Flask(__name__)

UPSCAYL_PATH = "/opt/upscayl/upscayl-bin"
TEMP_DIR = "/tmp/upscayl"

# Ensure temp directory exists
os.makedirs(TEMP_DIR, exist_ok=True)

# Check if upscayl binary exists
print(f"Checking for upscayl binary at {UPSCAYL_PATH}")
print(f"Directory contents of /opt/upscayl:")
try:
    contents = os.listdir("/opt/upscayl")
    print(f"Contents: {contents}")
except Exception as e:
    print(f"Error listing directory: {e}")

if not os.path.exists(UPSCAYL_PATH):
    print(f"ERROR: Upscayl binary not found at {UPSCAYL_PATH}")
    # Try to find it elsewhere
    print("Searching for upscayl binary in /opt/upscayl...")
    for root, dirs, files in os.walk("/opt/upscayl"):
        for file in files:
            if "upscayl" in file.lower():
                print(f"Found potential binary: {os.path.join(root, file)}")
    exit(1)
else:
    print(f"Upscayl binary found at {UPSCAYL_PATH}")

if not os.access(UPSCAYL_PATH, os.X_OK):
    print(f"ERROR: Upscayl binary is not executable")
    exit(1)
else:
    print("Upscayl binary is executable")

def run_upscayl(input_path, output_path, scale=4):
    """Run Upscayl NCNN binary to upscale an image"""
    try:
        # Upscayl NCNN CLI command
        cmd = [
            UPSCAYL_PATH,
            "-i", input_path,
            "-o", output_path,
            "-s", str(scale),
            "-m", "realesrgan-x4plus",  # Default model
            "-f", "png"
        ]

        print(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd="/opt/upscayl")

        print(f"Upscayl stdout: {result.stdout}")
        if result.stderr:
            print(f"Upscayl stderr: {result.stderr}")

        if result.returncode != 0:
            print(f"Upscayl error: return code {result.returncode}")
            return False

        # Check if output file was created
        if not os.path.exists(output_path):
            print(f"Output file not found: {output_path}")
            return False

        return True
    except subprocess.TimeoutExpired:
        print("Upscayl process timed out")
        return False
    except Exception as e:
        print(f"Error running Upscayl: {e}")
        return False

def remove_background(input_path, output_path):
    """Remove background from image using rembg"""
    if remove is None:
        print("rembg not available, cannot remove background")
        return False

    try:
        print(f"Removing background from: {input_path}")

        # Open and remove background
        with Image.open(input_path) as img:
            # Convert to RGBA if not already
            if img.mode != 'RGBA':
                img = img.convert('RGBA')

            # Remove background
            output_img = remove(img)

            # Save the result
            output_img.save(output_path, 'PNG')

        print(f"Background removed successfully: {output_path}")
        return True
    except Exception as e:
        print(f"Error removing background: {e}")
        return False

@app.route('/process', methods=['POST'])
def process_image():
    try:
        # Get the uploaded file
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Get action parameter
        action = request.form.get('action', 'upscale')

        # Generate unique filenames
        unique_id = str(uuid.uuid4())
        input_path = os.path.join(TEMP_DIR, f"input_{unique_id}.png")
        output_path = os.path.join(TEMP_DIR, f"output_{unique_id}.png")

        # Save uploaded file as PNG
        image = Image.open(file.stream)
        image.save(input_path, 'PNG')

        success = False

        if action == 'upscale':
            # Get scale parameter (default to 4)
            scale = int(request.form.get('scale', 4))
            success = run_upscayl(input_path, output_path, scale)
        elif action == 'remove_bg':
            success = remove_background(input_path, output_path)
        else:
            return jsonify({'error': 'Invalid action specified'}), 400

        # Clean up input file
        if os.path.exists(input_path):
            os.remove(input_path)

        if not success or not os.path.exists(output_path):
            return jsonify({'error': f'Failed to {action.replace("_", " ")} image'}), 500

        # Return the processed image
        action_name = "upscaled" if action == "upscale" else "nobg"
        return send_file(output_path, mimetype='image/png', as_attachment=True,
                        download_name=f"{action_name}_{file.filename}")

    except Exception as e:
        print(f"Error processing request: {e}")
        return jsonify({'error': 'Internal server error'}), 500

    finally:
        # Clean up output file after sending
        if 'output_path' in locals() and os.path.exists(output_path):
            try:
                os.remove(output_path)
            except:
                pass

@app.route('/upscale', methods=['POST'])
def upscale_image():
    """Legacy endpoint for backward compatibility"""
    try:
        # Get the uploaded file
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Get scale parameter (default to 4)
        scale = int(request.form.get('scale', 4))

        # Generate unique filenames
        unique_id = str(uuid.uuid4())
        input_path = os.path.join(TEMP_DIR, f"input_{unique_id}.png")
        output_path = os.path.join(TEMP_DIR, f"output_{unique_id}.png")

        # Save uploaded file as PNG
        image = Image.open(file.stream)
        image.save(input_path, 'PNG')

        # Run Upscayl
        success = run_upscayl(input_path, output_path, scale)

        # Clean up input file
        if os.path.exists(input_path):
            os.remove(input_path)

        if not success or not os.path.exists(output_path):
            return jsonify({'error': 'Failed to upscale image'}), 500

        # Return the upscaled image
        return send_file(output_path, mimetype='image/png', as_attachment=True,
                        download_name=f"upscaled_{file.filename}")

    except Exception as e:
        print(f"Error processing request: {e}")
        return jsonify({'error': 'Internal server error'}), 500

    finally:
        # Clean up output file after sending
        if 'output_path' in locals() and os.path.exists(output_path):
            try:
                os.remove(output_path)
            except:
                pass

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'upscayl'})

if __name__ == '__main__':
    print("Starting Upscayl service...")
    try:
        app.run(host='0.0.0.0', port=5001, debug=True)
    except Exception as e:
        print(f"Error starting Flask app: {e}")
        import traceback
        traceback.print_exc()
