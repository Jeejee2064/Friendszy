package ca.friendszy.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Écran hors-ligne natif (vues Android, pas une page web) : dégradé teal → bleu
 * Friendszy, logo, message FR/EN/ES (ressources values / values-en / values-es)
 * et bouton « Réessayer ». Posé par-dessus la WebView (et les barres natives).
 */
final class OfflineOverlay {
    private final FrameLayout root;
    private final TextView status;
    private final Button retry;

    OfflineOverlay(Activity activity, Runnable onRetry) {
        float d = activity.getResources().getDisplayMetrics().density;

        root = new FrameLayout(activity);
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { Color.parseColor("#1ecfb0"), Color.parseColor("#1ab8c0"), Color.parseColor("#1a90c8") }
        );
        root.setBackground(bg);
        root.setClickable(true); // avale les touches : rien ne passe à la WebView derrière
        root.setVisibility(View.GONE);
        ViewCompat.setElevation(root, 1000f * d);

        LinearLayout col = new LinearLayout(activity);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = (int) (32 * d);
        col.setPadding(pad, pad, pad, pad);
        FrameLayout.LayoutParams colLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        root.addView(col, colLp);

        ImageView logo = new ImageView(activity);
        logo.setImageResource(R.drawable.friendszy_offline_logo);
        final float radius = 24 * d;
        logo.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius); }
        });
        logo.setClipToOutline(true);
        col.addView(logo, new LinearLayout.LayoutParams((int) (96 * d), (int) (96 * d)));

        TextView title = text(activity, R.string.offline_title, 24, true);
        LinearLayout.LayoutParams tlp = wrap();
        tlp.topMargin = (int) (28 * d);
        col.addView(title, tlp);

        TextView msg = text(activity, R.string.offline_message, 16, false);
        LinearLayout.LayoutParams mlp = wrap();
        mlp.topMargin = (int) (12 * d);
        col.addView(msg, mlp);

        status = text(activity, R.string.offline_still, 14, true);
        status.setVisibility(View.INVISIBLE);
        LinearLayout.LayoutParams slp = wrap();
        slp.topMargin = (int) (16 * d);
        col.addView(status, slp);

        retry = new Button(activity);
        retry.setText(R.string.offline_retry);
        retry.setAllCaps(false);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        retry.setTextSize(16);
        retry.setTextColor(Color.parseColor("#0d5f8a"));
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.WHITE);
        btnBg.setCornerRadius(28 * d);
        retry.setBackground(btnBg);
        retry.setPadding((int) (32 * d), 0, (int) (32 * d), 0);
        retry.setOnClickListener(v -> onRetry.run());
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, (int) (52 * d));
        blp.topMargin = (int) (24 * d);
        col.addView(retry, blp);

        // Edge-to-edge (API 36) : garde le contenu hors des barres système.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        activity.addContentView(root, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private static LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private static TextView text(Activity a, int res, int sp, boolean bold) {
        TextView t = new TextView(a);
        t.setText(res);
        t.setTextColor(Color.WHITE);
        t.setTextSize(sp);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    boolean isShowing() { return root.getVisibility() == View.VISIBLE; }

    void show() {
        status.setVisibility(View.INVISIBLE);
        root.setVisibility(View.VISIBLE);
        root.bringToFront(); // au-dessus des barres natives ajoutées après coup
        root.requestApplyInsets();
    }

    void hide() { root.setVisibility(View.GONE); }

    /** Appelé quand « Réessayer » est touché alors qu'il n'y a toujours pas de réseau. */
    void showStillOffline() { status.setVisibility(View.VISIBLE); }
}
