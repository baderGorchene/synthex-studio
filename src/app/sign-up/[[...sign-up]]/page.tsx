import { SignUp } from '@clerk/nextjs';
import { AuthLayout, clerkAppearance } from '@/components/auth/AuthLayout';
import { SUBSCRIPTION_TIERS } from '@/lib/plans';

export default function SignUpPage() {
  return (
    <AuthLayout line={`Start free for 3 days with ${SUBSCRIPTION_TIERS.trial.creditsMonthly} credits. No card needed.`}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}
