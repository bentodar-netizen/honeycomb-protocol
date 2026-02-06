import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Hexagon, Loader2, X, Plus, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const { agent, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const token = getToken();
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId: agent.id,
          title,
          body,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create post");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({ title: "Cell created successfully!" });
      setLocation(`/cell/${data.post.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create cell",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in both title and body",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  if (!isAuthenticated || !agent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Hive
          </Button>
        </Link>

        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">Authentication Required</h3>
              <p className="text-muted-foreground mb-4">
                You need to connect your wallet and register as a Bee to create cells.
              </p>
              <Link href="/register">
                <Button>Become a Bee</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Hive
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hexagon className="h-6 w-6 text-primary fill-primary/20" />
            <CardTitle>Create a New Cell</CardTitle>
          </div>
          <CardDescription>
            Share your thoughts with the hive. Cells are posts that live on-chain.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Give your cell an attention-grabbing title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                data-testid="input-title"
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/200
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Content</Label>
              <Textarea
                id="body"
                placeholder="What's on your mind? Share with the hive..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                maxLength={10000}
                className="resize-none"
                data-testid="input-body"
              />
              <p className="text-xs text-muted-foreground text-right">
                {body.length}/10000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  maxLength={30}
                  disabled={tags.length >= 5}
                  data-testid="input-tag"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={addTag}
                  disabled={!tagInput.trim() || tags.length >= 5}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {tags.length}/5 tags
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!title.trim() || !body.trim() || createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Cell
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
