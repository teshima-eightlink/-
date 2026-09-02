<?php
/**
 * Template Name: 症状ページ（共通テンプレート）
 * Template Post Type: page
 *
 * 症状別の固定ページを、共通のレイアウト・共通の導線で量産するためのテンプレート。
 *
 * 【この方式のメリット】
 *   固定ページの本文は空のままなので、エディタのビジュアル／コード切り替えで
 *   レイアウトが壊れることがありません。原稿はテーマ内のファイルで管理します。
 *
 * 【表示するデータの決まり方】
 *   固定ページのスラッグ（例: kubikori-katakori）と同じ名前の
 *   inc/symptoms/kubikori-katakori.php が読み込まれます。
 *   スラッグとファイル名を変えたい場合は、固定ページのカスタムフィールドに
 *   symptom_slug = ファイル名 を設定してください。
 *
 * 【構成】 ①共感 → ②解説 → ③評価 → ④方針 → ⑤実例 → ⑥専門性 → ⑦行動
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once get_theme_file_path( 'inc/symptom-render.php' );

$abc_html = abc_symptom_render();

get_header();

if ( '' === $abc_html ) {

	// データファイルが無いときは、固定ページ本文をそのまま表示して事故を防ぐ。
	while ( have_posts() ) :
		the_post();
		?>
		<section class="content_full">
			<div class="content_inner inner">
				<?php the_content(); ?>
				<?php if ( current_user_can( 'edit_pages' ) ) : ?>
					<p>※管理者にのみ表示：<code>inc/symptoms/<?php echo esc_html( abc_symptom_current_slug() ); ?>.php</code>
					が見つかりません。ファイル名と固定ページのスラッグを合わせてください。</p>
				<?php endif; ?>
			</div>
		</section>
		<?php
	endwhile;

} else {

	echo $abc_html; // phpcs:ignore WordPress.Security.EscapingOutput.OutputNotEscaped -- 出力側でエスケープ済み

}

get_footer();
