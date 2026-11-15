using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

public sealed class AesGcmConnectionSecretProtector(
    string? activeKeyId, IReadOnlyDictionary<string, string> encodedKeys) : IConnectionSecretProtector
{
    public ProtectedConnectionSecret Protect(string value, string organizationId, Guid dataSourceId,
        DataSourceProvider provider)
    {
        if (string.IsNullOrWhiteSpace(activeKeyId)) throw new ConnectionSecurityUnavailableException();
        var key = GetKey(activeKeyId);
        var plaintext = Encoding.UTF8.GetBytes(value);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];
        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Encrypt(nonce, plaintext, ciphertext, tag,
                AssociatedData(organizationId, dataSourceId, provider));
            return new ProtectedConnectionSecret(activeKeyId, Convert.ToBase64String(nonce),
                Convert.ToBase64String(ciphertext), Convert.ToBase64String(tag));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public string Unprotect(ProtectedConnectionSecret value, string organizationId, Guid dataSourceId,
        DataSourceProvider provider)
    {
        var key = GetKey(value.KeyId);
        byte[]? plaintext = null;
        try
        {
            var nonce = Convert.FromBase64String(value.Nonce);
            var ciphertext = Convert.FromBase64String(value.Ciphertext);
            var tag = Convert.FromBase64String(value.Tag);
            if (nonce.Length != 12 || tag.Length != 16)
                throw new ConnectionSecurityUnavailableException();
            plaintext = new byte[ciphertext.Length];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, ciphertext, tag, plaintext,
                AssociatedData(organizationId, dataSourceId, provider));
            return Encoding.UTF8.GetString(plaintext);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            throw new ConnectionSecurityUnavailableException();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            if (plaintext is not null) CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private byte[] GetKey(string keyId)
    {
        if (string.IsNullOrWhiteSpace(keyId) || !encodedKeys.TryGetValue(keyId, out var encoded))
            throw new ConnectionSecurityUnavailableException();
        try
        {
            var key = Convert.FromBase64String(encoded);
            if (key.Length != 32)
            {
                CryptographicOperations.ZeroMemory(key);
                throw new ConnectionSecurityUnavailableException();
            }
            return key;
        }
        catch (FormatException)
        {
            throw new ConnectionSecurityUnavailableException();
        }
    }

    private static byte[] AssociatedData(string organizationId, Guid id, DataSourceProvider provider) =>
        JsonSerializer.SerializeToUtf8Bytes(new[] { "analytics-connection-v1", organizationId,
            id.ToString("D"), provider.ToString() });
}
