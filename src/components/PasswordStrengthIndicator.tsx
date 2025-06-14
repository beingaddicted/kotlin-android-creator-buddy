
import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const analysis = useMemo(() => {
    if (!password) return { score: 0, feedback: [] };

    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 20;
    } else {
      feedback.push('Use at least 8 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 20;
    } else {
      feedback.push('Include uppercase letters');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 20;
    } else {
      feedback.push('Include lowercase letters');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 20;
    } else {
      feedback.push('Include numbers');
    }

    // Special character check
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 20;
    } else {
      feedback.push('Include special characters');
    }

    return { score, feedback };
  }, [password]);

  const getStrengthLabel = (score: number) => {
    if (score < 40) return { label: 'Weak', color: 'bg-red-500' };
    if (score < 60) return { label: 'Fair', color: 'bg-yellow-500' };
    if (score < 80) return { label: 'Good', color: 'bg-blue-500' };
    return { label: 'Strong', color: 'bg-green-500' };
  };

  if (!password) return null;

  const strength = getStrengthLabel(analysis.score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Password strength:</span>
        <span className={`text-sm font-medium ${
          analysis.score < 40 ? 'text-red-600' :
          analysis.score < 60 ? 'text-yellow-600' :
          analysis.score < 80 ? 'text-blue-600' : 'text-green-600'
        }`}>
          {strength.label}
        </span>
      </div>
      
      <Progress value={analysis.score} className="h-2" />
      
      {analysis.feedback.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1">
          {analysis.feedback.map((item, index) => (
            <li key={index} className="flex items-center space-x-2">
              <span className="w-1 h-1 bg-gray-400 rounded-full" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
