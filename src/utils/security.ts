// Security utilities for input sanitization and validation

import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
    ALLOWED_ATTR: []
  });
};

/**
 * Sanitizes plain text input
 */
export const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .slice(0, 10000); // Limit length to prevent abuse
};

/**
 * Validates patent idea input
 */
export const validatePatentIdea = (idea: string): { isValid: boolean; error?: string } => {
  if (!idea || idea.trim().length === 0) {
    return { isValid: false, error: 'Patent idea cannot be empty' };
  }
  
  if (idea.length < 10) {
    return { isValid: false, error: 'Patent idea must be at least 10 characters long' };
  }
  
  if (idea.length > 10000) {
    return { isValid: false, error: 'Patent idea cannot exceed 10,000 characters' };
  }
  
  return { isValid: true };
};

/**
 * Validates AI question input
 */
export const validateAiQuestion = (question: string): { isValid: boolean; error?: string } => {
  if (!question || question.trim().length === 0) {
    return { isValid: false, error: 'Question cannot be empty' };
  }
  
  if (question.length > 1000) {
    return { isValid: false, error: 'Question cannot exceed 1,000 characters' };
  }
  
  return { isValid: true };
};

/**
 * Validates patent section content
 */
export const validatePatentSection = (content: string): { isValid: boolean; error?: string } => {
  if (content && content.length > 50000) {
    return { isValid: false, error: 'Patent section cannot exceed 50,000 characters' };
  }
  
  return { isValid: true };
};

/**
 * Creates a safe error message that doesn't leak sensitive information
 */
export const createSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Only return safe, user-friendly messages
    const message = error.message.toLowerCase();
    
    if (message.includes('row-level security')) {
      return 'Access denied. Please ensure you are logged in.';
    }
    
    if (message.includes('foreign key')) {
      return 'Invalid session reference. Please try again.';
    }
    
    if (message.includes('unique constraint')) {
      return 'This record already exists.';
    }
    
    if (message.includes('not null')) {
      return 'Required information is missing.';
    }
    
    if (message.includes('check constraint')) {
      return 'Invalid data format provided.';
    }
    
    // Generic fallback for unknown errors
    return 'An unexpected error occurred. Please try again.';
  }
  
  return 'An unexpected error occurred. Please try again.';
};