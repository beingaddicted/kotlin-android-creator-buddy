
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('renders with text', () => {
    render(<LoadingSpinner text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveClass('w-4 h-4');

    rerender(<LoadingSpinner size="lg" data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveClass('w-12 h-12');
  });
});
