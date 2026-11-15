namespace AnalyticsDashboard.Application;

// Ciphertext is internal; never serialize this type from an HTTP endpoint.
public sealed record ProtectedConnectionSecret(string KeyId, string Nonce, string Ciphertext, string Tag);
