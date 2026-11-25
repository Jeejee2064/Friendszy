import UIKit
import WebKit
import Network
import Capacitor

/// Contrôleur principal : la WebView Capacitor + l'écran hors-ligne natif
/// (Apple 4.2 : jamais de page blanche ni de page d'erreur Safari).
/// Deux déclencheurs : pas de réseau (NWPathMonitor, y compris coupure en cours
/// d'utilisation) et échec de chargement de la page principale. Au retour du
/// réseau, la page est rechargée ; les cookies (session) persistent.
/// Équivalent iOS de MainActivity.java.
class MainViewController: CAPBridgeViewController {
    private var overlay: OfflineOverlayView?
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "ca.friendszy.app.network")
    private var isOnline = true
    private var mainFrameFailed = false
    private var navigationProxy: NavigationProxy?

    override func viewDidLoad() {
        super.viewDidLoad()

        let overlay = OfflineOverlayView(onRetry: { [weak self] in self?.retry() })
        overlay.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        self.overlay = overlay

        // Capacitor est le navigationDelegate de la WebView : on s'intercale (proxy)
        // pour voir les échecs de chargement sans lui retirer ses responsabilités.
        if let webView = webView, let original = webView.navigationDelegate {
            let proxy = NavigationProxy(original: original)
            proxy.onProvisionalFailure = { [weak self] in
                self?.mainFrameFailed = true
                self?.overlay?.show()
            }
            proxy.onFinish = { [weak self] in
                guard let self = self else { return }
                self.mainFrameFailed = false
                if self.isOnline { self.overlay?.hide() }
            }
            proxy.onStart = { [weak self] in self?.mainFrameFailed = false }
            webView.navigationDelegate = proxy
            navigationProxy = proxy // WKWebView garde le delegate en weak
        }

        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            DispatchQueue.main.async {
                guard let self = self else { return }
                let wasOnline = self.isOnline
                self.isOnline = online
                if !online {
                    self.overlay?.show()
                } else if !wasOnline, self.overlay?.isShowing == true {
                    self.reloadAfterOffline()
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    deinit { monitor.cancel() }

    private func retry() {
        if isOnline { reloadAfterOffline() } else { overlay?.showStillOffline() }
    }

    private func reloadAfterOffline() {
        guard let webView = webView else { return }
        mainFrameFailed = false
        overlay?.hide()
        // Page principale en échec (ou lancement à froid sans réseau) : pas d'URL
        // utilisable, on recharge le serveur configuré.
        if webView.url == nil || webView.url?.absoluteString == "about:blank" {
            if let url = bridge?.config.serverURL {
                webView.load(URLRequest(url: url))
            }
        } else {
            webView.reload()
        }
    }
}

/// Relais de WKNavigationDelegate : observe début/fin/échec de la navigation
/// principale et transmet TOUT le reste (décisions de navigation, défis
/// d'authentification, etc.) au delegate d'origine de Capacitor.
private final class NavigationProxy: NSObject, WKNavigationDelegate {
    private let original: WKNavigationDelegate
    var onStart: (() -> Void)?
    var onFinish: (() -> Void)?
    var onProvisionalFailure: (() -> Void)?

    init(original: WKNavigationDelegate) {
        self.original = original
        super.init()
    }

    // Toute méthode non implémentée ici est routée vers le delegate d'origine.
    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (original as AnyObject).responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        (original as AnyObject).responds(to: aSelector) ? original : super.forwardingTarget(for: aSelector)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        onStart?()
        original.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onFinish?()
        original.webView?(webView, didFinish: navigation)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        // Une navigation annulée (lien intercepté, redirection) n'est pas une panne réseau.
        if (error as NSError).code != NSURLErrorCancelled {
            onProvisionalFailure?()
        }
        original.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }
}
