import { LoginClient } from "./login-client";
import { authProviders, isProviderEnabled } from "@/lib/auth-providers";

export default function LoginPage() {
  const providerEnvStatus = authProviders.map(provider => {
    const envVarStatus = provider.envVarInfo?.map(envVar => ({
      name: envVar.name,
      set: !!process.env[envVar.name],
      source: envVar.source,
      defaultValue: envVar.defaultValue
    })) || [];
    
    return {
      id: provider.id,
      name: provider.name,
      enabled: isProviderEnabled(provider),
      required: provider.required,
      envVarInfo: provider.envVarInfo,
      envVarStatus
    };
  });
  
  return <LoginClient providers={providerEnvStatus} />;
}
