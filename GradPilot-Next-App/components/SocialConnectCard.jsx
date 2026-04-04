"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { CheckCircle2, XCircle, Linkedin, Twitter } from "lucide-react";

export default function SocialConnectCard() {
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
    
    // Check URL params for success messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'connected') {
      toast.success('LinkedIn connected successfully!');
      window.history.replaceState({}, '', '/profile');
    }
    if (params.get('twitter') === 'connected') {
      toast.success('Twitter connected successfully!');
      window.history.replaceState({}, '', '/profile');
    }
    if (params.get('error')) {
      toast.error(`Connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const res = await fetch('/api/user/social-status');
      if (res.ok) {
        const data = await res.json();
        setLinkedinConnected(data.linkedin || false);
        setTwitterConnected(data.twitter || false);
      }
    } catch (e) {
      console.error('Failed to check social connection status', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedinAuth = () => {
    window.location.href = "/api/linkedin/auth";
  };

  const handleTwitterAuth = () => {
    window.location.href = "/api/twitter/auth";
  };

  return (
    <Card className="border-border/40 backdrop-blur-sm bg-card/50">
      <CardHeader>
        <CardTitle className="ivy-font flex items-center gap-2">
          Social Media Integration
        </CardTitle>
        <CardDescription className="ivy-font">
          Connect your LinkedIn and Twitter accounts to enable auto-posting from campaign workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LinkedIn */}
          <div className="p-4 rounded-lg border border-border/40 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-blue-700/10">
                  <Linkedin className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="font-medium ivy-font">LinkedIn</p>
                  <p className="text-xs text-muted-foreground ivy-font">Professional network</p>
                </div>
              </div>
              {linkedinConnected ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-muted-foreground/20">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <Button 
              onClick={handleLinkedinAuth} 
              className="w-full bg-blue-700 hover:bg-blue-800 text-white ivy-font"
              disabled={loading}
            >
              {linkedinConnected ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}
            </Button>
          </div>

          {/* Twitter */}
          <div className="p-4 rounded-lg border border-border/40 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-sky-500/10">
                  <Twitter className="w-5 h-5 text-sky-500" />
                </div>
                <div>
                  <p className="font-medium ivy-font">Twitter</p>
                  <p className="text-xs text-muted-foreground ivy-font">Social media platform</p>
                </div>
              </div>
              {twitterConnected ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-muted-foreground/20">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <Button 
              onClick={handleTwitterAuth} 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white ivy-font"
              disabled={loading}
            >
              {twitterConnected ? 'Reconnect Twitter' : 'Connect Twitter'}
            </Button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs text-muted-foreground ivy-font">
            <strong className="text-foreground">💡 Tip:</strong> Once connected, LinkedIn and Twitter posting nodes in your campaign workflows will automatically publish generated content to your accounts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
