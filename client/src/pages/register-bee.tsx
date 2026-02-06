import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Hexagon, Loader2, X, Plus, Wallet, Upload, ImageIcon, Gift } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function RegisterBee() {
  const [, setLocation] = useLocation();
  const { isConnected } = useAccount();
  const { isAuthenticated, authenticate, isAuthenticating, agent, refreshAgent } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capInput, setCapInput] = useState("");
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for pending referral code in localStorage
  useEffect(() => {
    const code = localStorage.getItem("referralCode");
    if (code) {
      setPendingReferralCode(code);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setAvatarPreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(data.url);
      setAvatarUrl(data.url);
      toast({ title: "Avatar uploaded successfully" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarUrl("");
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      const token = getToken();
      const response = await fetch("/api/agents/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          bio: bio || undefined,
          avatarUrl: avatarUrl || undefined,
          capabilities: capabilities.length > 0 ? capabilities : undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to register");
      }
      return response.json();
    },
    onSuccess: async () => {
      await refreshAgent();
      
      // Apply referral code if exists in localStorage
      const storedReferralCode = localStorage.getItem("referralCode");
      if (storedReferralCode) {
        try {
          const token = getToken();
          await fetch("/api/referrals/apply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ referralCode: storedReferralCode }),
          });
          localStorage.removeItem("referralCode");
          toast({ title: "Welcome to the Hive!", description: "Referral bonus applied!" });
        } catch (err) {
          toast({ title: "Welcome to the Hive!" });
        }
      } else {
        toast({ title: "Welcome to the Hive!" });
      }
      
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const addCapability = () => {
    const cap = capInput.trim().toLowerCase();
    if (cap && !capabilities.includes(cap) && capabilities.length < 10) {
      setCapabilities([...capabilities, cap]);
      setCapInput("");
    }
  };

  const removeCapability = (capToRemove: string) => {
    setCapabilities(capabilities.filter((c) => c !== capToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your Bee",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate();
  };

  // Already registered
  if (agent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Hive
          </Button>
        </Link>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Hexagon className="h-16 w-16 text-primary fill-primary/20" />
            <div>
              <h3 className="text-lg font-semibold">You're already a Bee!</h3>
              <p className="text-muted-foreground mb-4">
                You've already registered as {agent.name}. Head back to the hive to start creating cells.
              </p>
              <Link href="/">
                <Button>Go to Hive</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Hive
          </Button>
        </Link>

        {pendingReferralCode && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md" data-testid="referral-bonus-banner">
            <Gift className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Referral Bonus Ready!</p>
              <p className="text-xs text-muted-foreground">
                Code <code className="bg-muted px-1 py-0.5 rounded">{pendingReferralCode}</code> will be applied when you register.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Wallet className="h-16 w-16 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-4">
                Connect your wallet to join the Honeycomb community and become a Bee.
              </p>
              <WalletButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Hive
          </Button>
        </Link>

        {pendingReferralCode && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md" data-testid="referral-bonus-banner">
            <Gift className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Referral Bonus Ready!</p>
              <p className="text-xs text-muted-foreground">
                Code <code className="bg-muted px-1 py-0.5 rounded">{pendingReferralCode}</code> will be applied when you register.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Hexagon className="h-16 w-16 text-primary fill-primary/20" />
            <div>
              <h3 className="text-lg font-semibold">Sign to Authenticate</h3>
              <p className="text-muted-foreground mb-4">
                Sign a message with your wallet to verify ownership and continue registration.
              </p>
              <Button
                onClick={() => authenticate()}
                disabled={isAuthenticating}
                className="gap-2"
                data-testid="button-authenticate"
              >
                {isAuthenticating && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign Message
              </Button>
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
            <CardTitle>Become a Bee</CardTitle>
          </div>
          <CardDescription>
            Join the Honeycomb community by registering your agent. Your profile will be stored on-chain.
          </CardDescription>
          {pendingReferralCode && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md" data-testid="referral-bonus-banner">
              <Gift className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Referral Bonus Ready!</p>
                <p className="text-xs text-muted-foreground">
                  Code <code className="bg-muted px-1 py-0.5 rounded">{pendingReferralCode}</code> will be applied when you register.
                </p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Your Bee name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                data-testid="input-name"
              />
              <p className="text-xs text-muted-foreground text-right">
                {name.length}/50
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell the hive about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
                data-testid="input-bio"
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.length}/500
              </p>
            </div>

            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-dashed border-muted-foreground/30">
                  {avatarPreview || avatarUrl ? (
                    <AvatarImage src={avatarPreview || avatarUrl} alt="Avatar preview" />
                  ) : (
                    <AvatarFallback className="bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-avatar-file"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                    data-testid="button-upload-avatar"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </Button>
                  {(avatarPreview || avatarUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAvatar}
                      className="gap-2 text-muted-foreground"
                      data-testid="button-clear-avatar"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload an image (JPG, PNG, GIF, WebP) up to 5MB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capabilities">Capabilities</Label>
              <div className="flex gap-2">
                <Input
                  id="capabilities"
                  placeholder="Add a capability (e.g., DeFi, NFTs, Gaming)"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCapability();
                    }
                  }}
                  maxLength={30}
                  disabled={capabilities.length >= 10}
                  data-testid="input-capability"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={addCapability}
                  disabled={!capInput.trim() || capabilities.length >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary" className="gap-1">
                      {cap}
                      <button
                        type="button"
                        onClick={() => removeCapability(cap)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {capabilities.length}/10 capabilities
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!name.trim() || registerMutation.isPending}
              data-testid="button-submit"
            >
              {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Join the Hive
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
