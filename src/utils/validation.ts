
import { z } from 'zod';

// Organization validation schemas
export const organizationSchema = z.object({
  name: z.string()
    .min(3, 'Organization name must be at least 3 characters')
    .max(100, 'Organization name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Organization name contains invalid characters'),
});

// User profile validation schemas
export const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .email('Please enter a valid email address')
    .max(254, 'Email address is too long'),
  phone: z.string()
    .regex(/^\+?[\d\s-()]{10,}$/, 'Please enter a valid phone number')
    .optional(),
  age: z.number()
    .min(13, 'Must be at least 13 years old')
    .max(120, 'Please enter a valid age')
    .optional(),
});

// Authentication validation schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, 
      'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Location validation schema
export const locationSchema = z.object({
  latitude: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude'),
  longitude: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude'),
  accuracy: z.number()
    .min(0, 'Accuracy must be positive')
    .optional(),
});

// Subscription validation schema
export const subscriptionSchema = z.object({
  planId: z.enum(['basic', 'premium', 'enterprise'], {
    errorMap: () => ({ message: 'Please select a valid plan' })
  }),
  memberCount: z.number()
    .min(1, 'Must have at least 1 member')
    .max(10000, 'Maximum 10,000 members allowed'),
});
