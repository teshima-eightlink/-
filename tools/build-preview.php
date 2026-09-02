<?php
/**
 * 症状ページのプレビューHTMLを書き出すツール（開発用・WordPress不要）
 *
 * WordPress の関数を最小限だけ再現して page-symptom.php を実行し、
 * ブラウザで確認できる1枚のHTMLとして preview/ に保存します。
 * 本番サーバーにアップロードする必要はありません。
 *
 * 使い方:
 *   php tools/build-preview.php kubikori-katakori
 *   php tools/build-preview.php            ← inc/symptoms/ の全ファイルを書き出し
 */

declare( strict_types = 1 );

define( 'ABSPATH', __DIR__ . '/../theme/' );

$theme_dir  = __DIR__ . '/../theme';
$output_dir = __DIR__ . '/../preview';

/* ------------------------------------------------------------------
 * プレビュー用のデモ設定（本番の symptom-config.php は書き換えません）
 * ---------------------------------------------------------------- */
$GLOBALS['abc_preview_config'] = array(
	'clinic' => array(
		'address' => '【プレビュー用】新潟県新潟市中央区○○1-2-3',
		'access'  => '【プレビュー用】JR新潟駅より徒歩○分／駐車場あり',
		'hours'   => '【プレビュー用】9:00〜20:00（最終受付19:00）',
		'holiday' => '【プレビュー用】日曜・祝日',
	),
	'cta' => array(
		'tel'         => '025-000-0000',
		'line_url'    => 'https://line.me/',
		'web_url'     => '/contact/',
		'first_price' => '【プレビュー用】初回 60分 ○,○○○円',
		'price_note'  => '2回目以降の料金はこちらに表示されます',
	),
);

/* ------------------------------------------------------------------
 * WordPress 関数の最小スタブ
 * ---------------------------------------------------------------- */
$GLOBALS['abc_preview_slug']  = '';
$GLOBALS['abc_preview_title'] = '';

function get_theme_file_path( $path = '' ) {
	return __DIR__ . '/../theme/' . ltrim( $path, '/' );
}

function get_queried_object_id() {
	return 1;
}

function get_post_meta( $id, $key, $single = false ) {
	return '';
}

function get_post( $id = null ) {
	return (object) array( 'post_name' => $GLOBALS['abc_preview_slug'] );
}

function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}

function home_url( $path = '' ) {
	return 'https://abc-chiro.net' . $path;
}

function get_permalink() {
	return home_url( '/' . $GLOBALS['abc_preview_slug'] . '/' );
}

function get_the_title() {
	return $GLOBALS['abc_preview_title'];
}

function esc_html( $t ) {
	return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' );
}

function esc_attr( $t ) {
	return esc_html( $t );
}

function esc_url( $u ) {
	return esc_html( $u );
}

function wp_kses_post( $html ) {
	return $html; // プレビューなので原稿をそのまま通す
}

function wp_json_encode( $data, $flags = 0 ) {
	return json_encode( $data, $flags );
}

function current_user_can( $cap ) {
	return false;
}

function wp_style_is( $handle, $status = 'enqueued' ) {
	return false;
}

function have_posts() {
	return false;
}

function the_post() {}
function the_title() {
	echo esc_html( get_the_title() );
}
function the_content() {}

function apply_filters( $hook, $value ) {
	if ( 'abc_symptom_config' !== $hook ) {
		return $value;
	}

	foreach ( $GLOBALS['abc_preview_config'] as $group => $fields ) {
		foreach ( $fields as $key => $val ) {
			if ( empty( $value[ $group ][ $key ] ) ) {
				$value[ $group ][ $key ] = $val;
			}
		}
	}

	return $value;
}

function get_header() {
	$title = esc_html( get_the_title() );
	echo <<<HTML
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$title}｜ABCカイロプラクティック整体院（プレビュー）</title>
<style>
	body { margin: 0; }
	.preview-bar {
		position: sticky; top: 0; z-index: 99;
		padding: 8px 16px; background: #333b42; color: #fff;
		font: 13px/1.6 -apple-system, "Hiragino Sans", sans-serif;
	}
</style>
</head>
<body>
<div class="preview-bar">表示確認用プレビューです。ヘッダー・フッターは実際のテーマのものに置き換わります。【プレビュー用】と書かれた箇所は inc/symptom-config.php で設定してください。</div>
HTML;
}

function get_footer() {
	echo "\n</body>\n</html>\n";
}

/* ------------------------------------------------------------------
 * 書き出し
 * ---------------------------------------------------------------- */
$targets = array_slice( $argv, 1 );

if ( empty( $targets ) ) {
	foreach ( glob( $theme_dir . '/inc/symptoms/*.php' ) as $file ) {
		$name = basename( $file, '.php' );
		if ( '_' !== $name[0] ) {
			$targets[] = $name;
		}
	}
}

if ( ! is_dir( $output_dir ) ) {
	mkdir( $output_dir, 0755, true );
}

foreach ( $targets as $slug ) {
	$data = require $theme_dir . '/inc/symptoms/' . $slug . '.php';

	$GLOBALS['abc_preview_slug']  = $slug;
	$GLOBALS['abc_preview_title'] = $data['title'] ?? $slug;

	ob_start();
	include $theme_dir . '/page-symptom.php';
	$html = ob_get_clean();

	$out = $output_dir . '/' . $slug . '.html';
	file_put_contents( $out, $html );

	printf( "書き出しました: preview/%s.html (%d bytes)\n", $slug, strlen( $html ) );
}
