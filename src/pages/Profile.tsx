import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { ArrowLeft, Camera, Loader2, User, Building, FileText, Save, X } from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { formatDatePatent } from '@/lib/dateUtils';

const Profile = () => {
  const { user, profile, loading, updateProfile, uploadAvatar } = useUserProfile();
  const [formData, setFormData] = useState({
    display_name: '',
    full_name: '',
    company: '',
    bio: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        full_name: profile.full_name || '',
        company: profile.company || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (!isEditing) setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateProfile(formData);
      if (success) {
        toast({
          title: "Profile updated",
          description: "Your profile has been saved successfully.",
        });
        setIsEditing(false);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      if (url) {
        toast({
          title: "Avatar updated",
          description: "Your profile picture has been updated.",
        });
        setPreviewUrl(null);
      } else {
        throw new Error('Failed to upload avatar');
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadAvatar, toast]);

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Profile />
      <div className="safe-area py-6 sm:py-8 px-4 sm:px-6">
        <div className="content-width max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Dashboard</span>
            </Button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1">
              Your Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your personal information
            </p>
          </div>

          {/* Avatar Section */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="w-4 h-4" />
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar 
                    className="h-16 w-16 sm:h-20 sm:w-20 cursor-pointer ring-2 ring-primary/20"
                    onClick={handleAvatarClick}
                  >
                    <AvatarImage 
                      src={previewUrl || profile?.avatar_url || undefined} 
                      alt="Profile"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div 
                    className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={handleAvatarClick}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{profile?.display_name || user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {uploadingAvatar && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Info */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="display_name" className="text-xs">Display Name</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    placeholder="How you want to be called"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="full_name" className="text-xs">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Your full legal name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="company" className="flex items-center gap-1 text-xs">
                  <Building className="w-3 h-3" />
                  Company
                </Label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Your company or organization"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bio" className="flex items-center gap-1 text-xs">
                  <FileText className="w-3 h-3" />
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Info (read-only) */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Created</Label>
                <p className="text-sm font-medium">
                  {formatDatePatent(profile?.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex flex-col xs:flex-row justify-end gap-2">
            {isEditing && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  if (profile) {
                    setFormData({
                      display_name: profile.display_name || '',
                      full_name: profile.full_name || '',
                      company: profile.company || '',
                      bio: profile.bio || '',
                    });
                  }
                }}
                className="gap-2"
                size="sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleSave} 
              disabled={saving || !isEditing} 
              className="gap-2"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
