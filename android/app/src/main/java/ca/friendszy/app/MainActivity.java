package ca.friendszy.app;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Écran hors-ligne natif (Apple 4.2 : jamais de page blanche ni de page d'erreur
 * Chrome). Deux déclencheurs : pas de réseau (ConnectivityManager, y compris
 * coupure en cours d'utilisation) et échec de chargement de la page principale.
 * Au retour du réseau, la page est rechargée ; les cookies (session) persistent.
 */
public class MainActivity extends BridgeActivity {
    private OfflineOverlay overlay;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    // Dernier chargement de la page principale en échec ? (reset à chaque nouveau chargement)
    private volatile boolean mainFrameFailed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        connectivity = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        overlay = new OfflineOverlay(this, this::retry);

        final WebView webView = getBridge().getWebView();
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                // Seules les erreurs de la page principale comptent (pas une image ou une tuile ratée).
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    runOnUiThread(() -> overlay.show());
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!mainFrameFailed && isOnline()) {
                    runOnUiThread(() -> overlay.hide());
                }
            }
        });

        // Lancement à froid sans réseau : on montre l'écran tout de suite, sans attendre l'échec.
        if (!isOnline()) overlay.show();

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> { if (overlay.isShowing()) reloadAfterOffline(); });
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> { if (!isOnline()) overlay.show(); });
            }
        };
        connectivity.registerDefaultNetworkCallback(networkCallback);
    }

    @Override
    public void onDestroy() {
        if (connectivity != null && networkCallback != null) {
            try { connectivity.unregisterNetworkCallback(networkCallback); } catch (IllegalArgumentException ignored) {}
        }
        super.onDestroy();
    }

    private boolean isOnline() {
        Network n = connectivity.getActiveNetwork();
        if (n == null) return false;
        NetworkCapabilities c = connectivity.getNetworkCapabilities(n);
        return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void retry() {
        if (isOnline()) reloadAfterOffline();
        else overlay.showStillOffline();
    }

    private void reloadAfterOffline() {
        WebView webView = getBridge().getWebView();
        mainFrameFailed = false;
        overlay.hide();
        // Page principale en échec : l'URL courante est celle de l'erreur, on recharge le serveur.
        String url = webView.getUrl();
        if (url == null || url.startsWith("chrome-error") || url.equals("about:blank")) {
            webView.loadUrl(getBridge().getServerUrl());
        } else {
            webView.reload();
        }
    }
}
