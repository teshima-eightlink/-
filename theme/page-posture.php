<?php
/**
 * Template Name: 姿勢改善ページ
 * Template Post Type: page
 *
 * 本文は空のままで構いません。表示内容は inc/pages/shisei.php から読み込まれます。
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once get_theme_file_path( 'inc/posture-render.php' );

$abc_html = abc_posture_render();

get_header();

if ( '' === $abc_html ) {
	while ( have_posts() ) :
		the_post();
		?>
		<section class="content_full">
			<div class="content_inner inner"><?php the_content(); ?></div>
		</section>
		<?php
	endwhile;
} else {
	echo $abc_html; // phpcs:ignore WordPress.Security.EscapingOutput.OutputNotEscaped -- 出力側でエスケープ済み
}

get_footer();
