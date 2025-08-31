import { useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Card } from './components/ui/card';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { Upload, Settings, Layers, Image, Workflow, FileDown } from 'lucide-react';

export default function App() {
  const [selectedImages, setSelectedImages] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(false);

  const sidebarItems = [
    { name: 'Generate', icon: Layers, active: false },
    { name: 'Image Edit', icon: Image, active: false },
    { name: 'Model', icon: Layers, active: false },
    { name: 'Workflow', icon: Workflow, active: true },
    { name: 'Settings', icon: Settings, active: false },
  ];

  const actionButtons = [
    { name: 'Download CSV', variant: 'secondary', icon: FileDown },
    { name: 'Generate AI', variant: 'secondary', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { name: 'Edit AI Alt', variant: 'secondary', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
    { name: 'Scale All', variant: 'secondary', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { name: 'Remove BG All', variant: 'secondary', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { name: 'Upscale All', variant: 'secondary', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  ];

  const productActions = [
    { name: 'Generate', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { name: 'Edit AI', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
    { name: 'Remove BG', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { name: 'Upscale', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
    { name: 'Scale', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { name: 'Delete', color: 'bg-red-600 hover:bg-red-700 text-white' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-52 bg-white border-r border-gray-200">
        <div className="p-4">
          <h2>Workflow</h2>
        </div>
        <nav className="space-y-1 px-3">
          {sidebarItems.map((item) => (
            <button
              key={item.name}
              className={`w-full flex items-center px-3 py-2 rounded-md transition-colors ${
                item.active 
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <div className="max-w-6xl">
            <h1 className="mb-2">Amazon Merch Workflow</h1>
            <p className="text-gray-600 mb-6">
              Upload and process your product images for Amazon merchandise listings. Generate, edit with AI, remove backgrounds, upscale, 
              then scale to Amazon dimensions.
            </p>

            {/* Upload Area */}
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center mb-6">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                <span className="text-blue-600 hover:text-blue-700 cursor-pointer">Click to upload</span> or drag and drop
              </p>
              <p className="text-sm text-gray-500">PNG, JPG, JPEG (MAX. 10MB)</p>
            </Card>

            {/* Image Selection and Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedImages} of 2 images selected
                </span>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                  Select All
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              {actionButtons.map((button, index) => (
                <Button
                  key={button.name}
                  variant={button.variant}
                  size="sm"
                  className={button.color || ''}
                >
                  {button.icon && <button.icon className="mr-2 h-4 w-4" />}
                  {button.name}
                </Button>
              ))}
            </div>

            {/* Warning Message */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <p className="text-sm text-yellow-800">
                Select one or more images to enable batch processing.
              </p>
            </div>

            {/* Product Form */}
            <div className="flex gap-6">
              {/* Product Image and Selection */}
              <div className="flex items-start gap-4">
                <Checkbox 
                  checked={selectedProduct}
                  onCheckedChange={setSelectedProduct}
                  className="mt-2"
                />
                <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">WITCH</span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input 
                    id="brand"
                    placeholder="Enter brand name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title"
                    placeholder="Enter product title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bullet1">Bullet 1</Label>
                  <Input 
                    id="bullet1"
                    placeholder="Enter bullet point 1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bullet2">Bullet 2</Label>
                  <Input 
                    id="bullet2"
                    placeholder="Enter bullet point 2"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    placeholder="Enter product description"
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {productActions.map((action) => (
                  <Button
                    key={action.name}
                    size="sm"
                    className={action.color}
                  >
                    {action.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}