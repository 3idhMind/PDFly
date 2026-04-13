import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ApiDocumentation = () => {
  const { toast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  const jsExample = `// JavaScript/TypeScript Example
const response = await fetch('https://api.yoursite.com/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    script_html: '<h1>My Script</h1><p>Content here...</p>',
    production_guide_html: '<h1>Production Guide</h1>',
    file_name_prefix: 'User_123',
    language: 'hi',
    template: 'professional'
  })
});

const data = await response.json();
console.log(data.script_pdf_url);
console.log(data.guide_pdf_url);`;

  const pythonExample = `# Python Example
import requests

response = requests.post(
    'https://api.yoursite.com/generate-pdf',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    json={
        'script_html': '<h1>My Script</h1><p>Content...</p>',
        'production_guide_html': '<h1>Production Guide</h1>',
        'file_name_prefix': 'User_123',
        'language': 'hi',
        'template': 'professional'
    }
)

data = response.json()
print(data['script_pdf_url'])
print(data['guide_pdf_url'])`;

  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <Code className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold text-foreground">API Integration</h3>
      </div>

      <p className="text-muted-foreground mb-6">
        Integrate PDF generation into your website or application using our REST API.
      </p>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">JavaScript Example</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyCode(jsExample)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          </div>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{jsExample}</code>
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">Python Example</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyCode(pythonExample)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          </div>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{pythonExample}</code>
          </pre>
        </div>

        <div className="bg-secondary/20 p-4 rounded-lg">
          <h4 className="font-semibold text-foreground mb-2">API Endpoint</h4>
          <code className="text-sm text-primary">POST /api/generate-pdf</code>
          
          <h4 className="font-semibold text-foreground mt-4 mb-2">Response</h4>
          <pre className="text-xs bg-muted p-3 rounded">
{`{
  "success": true,
  "script_pdf_url": "https://...",
  "guide_pdf_url": "https://..."
}`}
          </pre>
        </div>

        <Button className="w-full" variant="outline">
          <ExternalLink className="w-4 h-4 mr-2" />
          View Full Documentation
        </Button>
      </div>
    </Card>
  );
};
