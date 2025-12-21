import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  size = 'md', 
  className,
  showFallback = true,
}) => {
  const { user, profile } = useUserProfile();

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage 
        src={profile?.avatar_url || undefined} 
        alt={profile?.display_name || 'User avatar'}
        className="object-cover"
      />
      {showFallback && (
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {getInitials()}
        </AvatarFallback>
      )}
    </Avatar>
  );
};

export default UserAvatar;
