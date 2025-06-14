import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { z } from 'zod';

const testSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

describe('useFormValidation', () => {
  it('validates data correctly', () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      const validation = result.current.validate({
        email: 'invalid-email',
        password: '123',
      });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.email).toBe('Invalid email');
      expect(validation.errors.password).toBe('Password must be at least 8 characters');
    });
  });

  it('clears errors when validation passes', () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      result.current.validate({ email: 'invalid', password: '123' });
    });

    expect(result.current.hasErrors).toBe(true);

    act(() => {
      result.current.validate({ email: 'test@example.com', password: 'password123' });
    });

    expect(result.current.hasErrors).toBe(false);
  });
});
