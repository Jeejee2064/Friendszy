import UIKit

/// Écran hors-ligne natif (vues UIKit, pas une page web) : dégradé teal → bleu
/// Friendszy, logo, message FR/EN/ES et bouton « Réessayer ». Posé par-dessus la
/// WebView (et les barres natives). Équivalent iOS de OfflineOverlay.java.
final class OfflineOverlayView: UIView {
    private let statusLabel = UILabel()
    private let onRetry: () -> Void

    // Textes dans le code (pas de fichiers .strings) : un seul fichier à maintenir,
    // aucune ressource à enregistrer dans le projet Xcode.
    private struct Strings {
        let title: String
        let message: String
        let retry: String
        let still: String
    }

    private static func strings() -> Strings {
        let lang = Locale.preferredLanguages.first?.prefix(2).lowercased() ?? "fr"
        switch lang {
        case "en":
            return Strings(
                title: "No connection",
                message: "Friendszy needs the internet to connect you with your friends. Check your connection, then try again.",
                retry: "Try again",
                still: "Still no connection")
        case "es":
            return Strings(
                title: "Sin conexión",
                message: "Friendszy necesita Internet para conectarte con tus amigos. Revisa tu conexión e inténtalo de nuevo.",
                retry: "Reintentar",
                still: "Sigue sin haber conexión")
        default:
            return Strings(
                title: "Pas de connexion",
                message: "Friendszy a besoin d'Internet pour te retrouver tes amis. Vérifie ta connexion, puis réessaie.",
                retry: "Réessayer",
                still: "Toujours pas de connexion")
        }
    }

    init(onRetry: @escaping () -> Void) {
        self.onRetry = onRetry
        super.init(frame: .zero)
        isHidden = true
        // Avale les touches : rien ne passe à la WebView derrière.
        isUserInteractionEnabled = true
        build()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) non utilisé") }

    private func build() {
        let s = Self.strings()

        let gradient = CAGradientLayer()
        gradient.colors = [
            UIColor(red: 0x1e / 255, green: 0xcf / 255, blue: 0xb0 / 255, alpha: 1).cgColor,
            UIColor(red: 0x1a / 255, green: 0xb8 / 255, blue: 0xc0 / 255, alpha: 1).cgColor,
            UIColor(red: 0x1a / 255, green: 0x90 / 255, blue: 0xc8 / 255, alpha: 1).cgColor,
        ]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        layer.insertSublayer(gradient, at: 0)
        gradientLayer = gradient

        let logo = UIImageView(image: UIImage(named: "OfflineLogo"))
        logo.contentMode = .scaleAspectFill
        logo.layer.cornerRadius = 24
        logo.clipsToBounds = true
        logo.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            logo.widthAnchor.constraint(equalToConstant: 96),
            logo.heightAnchor.constraint(equalToConstant: 96),
        ])

        let title = label(s.title, size: 24, bold: true)
        let message = label(s.message, size: 16, bold: false)

        statusLabel.text = s.still
        statusLabel.textColor = .white
        statusLabel.font = .systemFont(ofSize: 14, weight: .bold)
        statusLabel.textAlignment = .center
        statusLabel.alpha = 0 // invisible mais garde sa place : pas de saut de mise en page

        let button = UIButton(type: .system)
        button.setTitle(s.retry, for: .normal)
        button.setTitleColor(UIColor(red: 0x0d / 255, green: 0x5f / 255, blue: 0x8a / 255, alpha: 1), for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        button.backgroundColor = .white
        button.layer.cornerRadius = 26
        button.contentEdgeInsets = UIEdgeInsets(top: 0, left: 32, bottom: 0, right: 32)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.heightAnchor.constraint(equalToConstant: 52).isActive = true
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [logo, title, message, statusLabel, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.setCustomSpacing(28, after: logo)
        stack.setCustomSpacing(16, after: message)
        stack.setCustomSpacing(24, after: statusLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let guide = safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: guide.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -32),
            title.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            title.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
            message.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            message.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
        ])
    }

    private var gradientLayer: CAGradientLayer?

    override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer?.frame = bounds
    }

    private func label(_ text: String, size: CGFloat, bold: Bool) -> UILabel {
        let l = UILabel()
        l.text = text
        l.textColor = .white
        l.font = .systemFont(ofSize: size, weight: bold ? .bold : .regular)
        l.textAlignment = .center
        l.numberOfLines = 0
        return l
    }

    @objc private func retryTapped() { onRetry() }

    var isShowing: Bool { !isHidden }

    func show() {
        statusLabel.alpha = 0
        isHidden = false
        superview?.bringSubviewToFront(self) // au-dessus des barres natives ajoutées après coup
    }

    func hide() { isHidden = true }

    /// Appelé quand « Réessayer » est touché alors qu'il n'y a toujours pas de réseau.
    func showStillOffline() { statusLabel.alpha = 1 }
}
