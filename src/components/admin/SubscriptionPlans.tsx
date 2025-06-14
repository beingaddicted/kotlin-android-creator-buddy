
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Users, DollarSign } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  pricePerMember: number;
  features: string[];
  popular?: boolean;
  maxMembers?: number;
}

interface SubscriptionPlansProps {
  currentMemberCount: number;
  onSelectPlan: (planId: string) => void;
  currentPlan?: string;
}

export const SubscriptionPlans = ({ currentMemberCount, onSelectPlan, currentPlan }: SubscriptionPlansProps) => {
  const plans: SubscriptionPlan[] = [
    {
      id: 'basic',
      name: 'Basic Plan',
      description: 'Perfect for small teams',
      pricePerMember: 10, // 10 cents
      features: [
        'Real-time location tracking',
        'Basic reporting',
        'Email support',
        'Up to 50 members'
      ],
      maxMembers: 50
    },
    {
      id: 'premium',
      name: 'Premium Plan',
      description: 'Great for growing organizations',
      pricePerMember: 8, // 8 cents (bulk discount)
      features: [
        'All Basic features',
        'Advanced analytics',
        'Priority support',
        'Custom reporting',
        'Up to 200 members',
        'API access'
      ],
      popular: true,
      maxMembers: 200
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      description: 'For large organizations',
      pricePerMember: 6, // 6 cents (bulk discount)
      features: [
        'All Premium features',
        'Dedicated support',
        'Custom integrations',
        'Advanced security',
        'Unlimited members',
        'SLA guarantee'
      ]
    }
  ];

  const calculateMonthlyCost = (pricePerMember: number) => {
    const cost = (currentMemberCount * pricePerMember) / 100;
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900">Choose Your Plan</h3>
        <p className="text-gray-600 mt-2">
          Select the plan that best fits your organization's needs
        </p>
        <div className="flex items-center justify-center space-x-2 mt-4">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-gray-600">
            Current members: <strong>{currentMemberCount}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isOverLimit = plan.maxMembers && currentMemberCount > plan.maxMembers;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-3 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge className="bg-green-500 text-white px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-gray-600 text-sm">{plan.description}</p>
                
                <div className="mt-4">
                  <div className="flex items-center justify-center space-x-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-3xl font-bold">
                      {calculateMonthlyCost(plan.pricePerMember)}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    ${(plan.pricePerMember / 100).toFixed(2)} per member
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.maxMembers && (
                  <div className="text-center pt-2 border-t">
                    <span className="text-sm text-gray-600">
                      Max {plan.maxMembers} members
                    </span>
                  </div>
                )}

                <Button
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isCurrentPlan || isOverLimit}
                  className={`w-full ${plan.popular ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                  variant={isCurrentPlan ? 'outline' : 'default'}
                >
                  {isCurrentPlan ? 'Current Plan' : 
                   isOverLimit ? 'Member Limit Exceeded' : 
                   'Select Plan'}
                </Button>

                {isOverLimit && (
                  <p className="text-xs text-red-600 text-center">
                    Your organization has {currentMemberCount} members, which exceeds this plan's limit.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
