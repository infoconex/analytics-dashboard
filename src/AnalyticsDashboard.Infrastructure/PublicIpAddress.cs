using System.Net;
using System.Net.Sockets;

namespace AnalyticsDashboard.Infrastructure;

public static class PublicIpAddress
{
    // Deliberately conservative. A global-unicast appearance does not replace egress ACLs.
    public static bool IsAllowed(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6 || address.IsIPv6Teredo
            || IPAddress.IsLoopback(address)) return false;
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var a = address.GetAddressBytes();
            return a[0] != 0 && a[0] != 10 && a[0] != 127
                && !(a[0] == 100 && a[1] is >= 64 and <= 127)
                && !(a[0] == 169 && a[1] == 254)
                && !(a[0] == 172 && a[1] is >= 16 and <= 31)
                && !(a[0] == 192 && (a[1] == 0 || a[1] == 168 || (a[1] == 88 && a[2] == 99)))
                && !(a[0] == 198 && (a[1] is 18 or 19 || (a[1] == 51 && a[2] == 100)))
                && !(a[0] == 203 && a[1] == 0 && a[2] == 113)
                && a[0] < 224;
        }
        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var a = address.GetAddressBytes();
            // 2000::/3 only, excluding documentation, Teredo and other special-purpose ranges.
            return a[0] is >= 0x20 and <= 0x3f
                && !(a[0] == 0x20 && a[1] == 0x01
                    && ((a[2] == 0x0d && a[3] == 0xb8)
                        || (a[2] == 0 && a[3] == 0)
                        || (a[2] == 0 && a[3] == 0x10)))
                && !(a[0] == 0x20 && a[1] == 0x02);
        }
        return false;
    }
}
