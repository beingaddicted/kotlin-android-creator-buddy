
import { useState, useCallback } from 'react';
import { z } from 'zod';

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const useFormValidation = <T extends Record<string, any>>(schema: z.ZodSchema<T>) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback((data: Partial<T>): ValidationResult => {
    setIsValidating(true);
    
    try {
      schema.parse(data);
      setErrors({});
      setIsValidating(false);
      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
        setIsValidating(false);
        return { isValid: false, errors: newErrors };
      }
      setIsValidating(false);
      return { isValid: false, errors: { general: 'Validation failed' } };
    }
  }, [schema]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const getFieldError = useCallback((fieldName: string) => {
    return errors[fieldName] || '';
  }, [errors]);

  return {
    errors,
    isValidating,
    validate,
    clearErrors,
    getFieldError,
    hasErrors: Object.keys(errors).length > 0
  };
};
