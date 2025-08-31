# Feature Plan: Amazon Merch Workflow Page

## 1. Overview of Current State

The existing application is a Next.js project with a focus on generating product metadata using AI. It has an established integration with OpenRouter for calling various large language models, as seen in `web/src/lib/openrouter.ts` and the `/api/generate` endpoint. The frontend has components for file uploads (`Uploader.tsx`) and data display (`EditableTable.tsx`), which can be reused or adapted. There is no existing UI or backend logic for sequential image processing (scaling, background removal, upscaling) as described in the PRD.

## 2. Overview of Final State

A new page will be created at `/workflow`. This page will allow users to upload multiple images and manage them in a list view. For each image, users can edit metadata (Brand, Title, etc.) and apply a series of processing steps: AI Edit, Scale, Background Removal, and Upscaling. These actions will be available for individual images and as batch operations for all images. The backend will be expanded with new API endpoints to handle each processing step, leveraging libraries like `sharp` and external services (run via Docker) for `rembg` and `Upscayl`. The existing OpenRouter integration will be used for the "Edit with AI" feature.

## 3. Files to Change/Create

-   **`web/src/app/workflow/page.tsx`**: (New) The main page component for the new workflow UI.
-   **`web/src/components/ImageManager.tsx`**: (New) The primary component to manage state, handle uploads, and render the list of images.
-   **`web/src/components/ImageRow.tsx`**: (New) A component for displaying a single image, its metadata fields, and action buttons.
-   **`web/src/components/BatchToolbar.tsx`**: (New) A component with buttons for performing actions on all selected images.
-   **`web/src/app/api/workflow/scale/route.ts`**: (New) Backend API endpoint for scaling images using `sharp`.
-   **`web/src/app/api/workflow/edit-ai/route.ts`**: (New) Backend API endpoint that uses the existing `openrouter.ts` lib to apply AI edits to images.
-   **`web/src/app/api/workflow/remove-bg/route.ts`**: (New) Backend API endpoint to call the `rembg` service.
-   **`web/src/app/api/workflow/upscale/route.ts`**: (New) Backend API endpoint to call the `Upscayl` service.
-   **`web/src/lib/types.ts`**: (Modify) Add new types for image objects, their status, and processing states.
-   **`package.json`**: (Modify) Add new dependencies, primarily `sharp`.
-   **`docker-compose.yml`**: (New) A new file to define and manage `rembg` and `Upscayl` services.
-   **`.env.local`**: (Modify) Add new environment variables for the URLs of the new image processing services.

## 4. Task Checklist

### Phase 1: Backend API and Services Setup

-   [ ] **Task 1.1: Set up Image Processing Services**
    -   [ ] Create a `docker-compose.yml` file at the root of the project.
    -   [ ] Add a service for `rembg` using a public Docker image. Expose its port.
    -   [ ] Add a service for `Upscayl` using a public Docker image. Expose its port.
    -   [ ] Add environment variables (`REMBG_API_URL`, `UPSCAYL_API_URL`) to `.env.local` pointing to the Docker services.

-   [ ] **Task 1.2: Implement Image Scaling API**
    -   [ ] Install `sharp`: `npm install sharp`.
    -   [ ] Create API route `web/src/app/api/workflow/scale/route.ts`.
    -   [ ] Implement logic to receive an image, scale it to 4500x5400 using `sharp` (with `fit: 'contain'`), and return the processed image.

-   [ ] **Task 1.3: Implement Background Removal API**
    -   [ ] Create API route `web/src/app/api/workflow/remove-bg/route.ts`.
    -   [ ] Implement logic to take an image and proxy the request to the `rembg` Docker service.

-   [ ] **Task 1.4: Implement Upscaling API**
    -   [ ] Create API route `web/src/app/api/workflow/upscale/route.ts`.
    -   [ ] Implement logic to take an image and proxy the request to the `Upscayl` Docker service.

-   [ ] **Task 1.5: Implement AI Edit API**
    -   [ ] Create API route `web/src/app/api/workflow/edit-ai/route.ts`.
    -   [ ] Reuse the `callOpenRouter` function from `web/src/lib/openrouter.ts`.
    -   [ ] Implement logic to take an image and a prompt, and return a new image URL from the AI model (e.g., a diffusion model available on OpenRouter).

### Phase 2: Frontend Development

-   [ ] **Task 2.1: Define Data Structures**
    -   [ ] Open `web/src/lib/types.ts`.
    -   [ ] Add a `WorkflowImage` interface with fields for `id`, `originalFile`, `processedUrl`, `thumbnailUrl`, `status` (`'pending'`, `'processing'`, `'done'`, `'error'`), and metadata (`brand`, `title`, etc.).

-   [ ] **Task 2.2: Create the Main Page and Layout**
    -   [ ] Create the new page file `web/src/app/workflow/page.tsx`.
    -   [ ] Add basic layout, including a title and a placeholder for the `ImageManager` component.

-   [ ] **Task 2.3: Build the Image Upload Component**
    -   [ ] Create `web/src/components/ImageManager.tsx`.
    -   [ ] Use or adapt the existing `Uploader.tsx` component to handle multiple image uploads.
    -   [ ] On upload, create a `WorkflowImage` object for each file and store them in the component's state.
    -   [ ] Generate client-side thumbnails for previews.

-   [ ] **Task 2.4: Build the Image Row Component**
    -   [ ] Create `web/src/components/ImageRow.tsx`.
    -   [ ] This component should receive a `WorkflowImage` object as a prop.
    -   [ ] Display the image thumbnail, a loading/status indicator, and editable input fields for metadata.
    -   [ ] Add buttons for `Scale`, `Edit AI`, `Remove BG`, `Upscale`, and `Delete`.
    -   [ ] Wire up the buttons to call the respective backend APIs. On success, update the image's `processedUrl` and `status` in the parent state.

-   [ ] **Task 2.5: Build the Batch Toolbar**
    -   [ ] Create `web/src/components/BatchToolbar.tsx`.
    -   [ ] Add buttons for `Scale All`, `Remove BG All`, etc.
    -   [ ] Implement functions that iterate through all images in the `ImageManager` state and trigger the API calls.

-   [ ] **Task 2.6: Assemble the Workflow Page**
    -   [ ] In `ImageManager.tsx`, render the `BatchToolbar` and a list of `ImageRow` components from its state.
    -   [ ] In `workflow/page.tsx`, render the `ImageManager` component.
    -   [ ] Ensure state is managed correctly, and UI updates reflect the status of each image during processing.
