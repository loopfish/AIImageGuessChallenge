import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function ImageTest() {
  const [prompt, setPrompt] = useState("A dog riding a skateboard");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  const handleGenerate = async () => {
    if (!prompt) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError("");
    addLog(`Generating image for prompt: "${prompt}"...`);

    try {
      const response = await apiRequest(
        "POST",
        "/api/test-image",
        { prompt }
      );

      const data = await response.json() as { success?: boolean; error?: string; imageUrl?: string };
      
      if (!data || !data.success || data.error) {
        throw new Error(data?.error || "Failed to generate image");
      }

      addLog("Successfully generated image!");
      setImageUrl(data.imageUrl || "");
    } catch (err: any) {
      console.error("Error generating image:", err);
      setError(err.message || "Failed to generate image");
      addLog(`Error: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Gemini Image Test Page
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Generate Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Image Prompt:
                </label>
                <Input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your image prompt here"
                  className="w-full"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Generating..." : "Generate Image"}
              </Button>

              {error && (
                <div className="text-red-500 mt-2 text-sm">{error}</div>
              )}

              <div className="mt-4 bg-gray-100 p-3 rounded-md max-h-[200px] overflow-y-auto">
                <h3 className="font-semibold mb-2 text-sm">Logs:</h3>
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No logs yet</p>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-xs font-mono">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Generated Image</CardTitle>
          </CardHeader>
          <CardContent>
            {imageUrl ? (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Generated"
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-12 flex items-center justify-center bg-gray-50 h-[300px]">
                <p className="text-gray-400">
                  {loading ? "Generating image..." : "No image generated yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}