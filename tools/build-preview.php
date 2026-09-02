<?php
/**
 * 症状ページのプレビューHTMLを書き出すツール（開発用・WordPress不要）
 *
 * WordPress の関数を最小限だけ再現して page-symptom.php を実行し、
 * ブラウザで確認できる1枚のHTMLとして preview/ に保存します。
 * 本番サーバーにアップロードする必要はありません。
 *
 * 使い方:
 *   php tools/build-preview.php                     全症状 × 両モードを書き出し
 *   php tools/build-preview.php kubikori-katakori   1つだけ書き出し
 *
 * 書き出されるもの:
 *   preview/〇〇.html          plain モード（独自CSSなし・テーマのデザインに任せる）
 *   preview/〇〇--styled.html  styled モード（付属CSSあり）
 *   paste/〇〇.html            ブロックエディタの「カスタムHTML」に貼るための本文だけ
 */

declare( strict_types = 1 );

define( 'ABSPATH', __DIR__ . '/../theme/' );

$theme_dir  = __DIR__ . '/../theme';
$output_dir = __DIR__ . '/../preview';

/* ------------------------------------------------------------------
 * プレビュー用の設定の上書き
 *
 * 空にしておくと、本番と同じ inc/symptom-config.php の内容で描画されます。
 * 検証用に値を入れたい場合のみ、下の配列に書いてください。
 *   例）'cta' => array( 'tel' => '025-000-0000' )
 * ---------------------------------------------------------------- */
$GLOBALS['abc_preview_config'] = array();

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
			$value[ $group ][ $key ] = $val;
		}
	}

	return $value;
}

function get_header() {
	$title = esc_html( get_the_title() );

	/*
	 * ここで出しているフォント・見出し・リンク色は「テーマ側のスタイルの代わり」です。
	 * 症状ページのCSSはこれらを一切上書きせず、そのまま受け継ぐ設計になっています。
	 * 実サイトでは、この部分が実際のテーマのスタイルに置き換わります。
	 */
	echo <<<HTML
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$title}｜ABCカイロプラクティック整体院（プレビュー）</title>
<style>
	/* ▼ テーマ側のスタイルの代役（症状ページCSSはここに一切干渉しません） */
	body {
		margin: 0;
		color: #333;
		background: #fff;
		font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
		font-size: 16px;
		line-height: 1.9;
	}
	/* テーマが .content_inner .inner 配下に当てている書式の代役 */
	.content_inner h2 { font-size: 1.5rem; line-height: 1.5; margin: 0 0 .8em; }
	.content_inner h3 { font-size: 1.05rem; line-height: 1.6; }
	.content_inner p  { margin: 0 0 1.4em; }
	.content_full     { padding: 2.5em 0; }
	.content_inner.inner { width: min(100% - 40px, 900px); margin-inline: auto; }
	a  { color: #008080; }
	/* ▲ ここまでが仮テーマ */

	.preview-bar {
		position: sticky; top: 0; z-index: 99;
		padding: 8px 16px; background: #333b42; color: #fff;
		font-size: 13px; line-height: 1.6;
	}
</style>
</head>
<body>
<div class="preview-bar">表示確認用プレビューです。フォント・文字サイズ・見出しは「仮テーマ」のもので、実サイトではSTORYのスタイルを受け継ぎます。</div>
HTML;
}

function get_footer() {
	echo "\n</body>\n</html>\n";
}

/**
 * 貼り付け用HTMLを読みやすく整える。
 *
 * ・属性を持たない <div>（レイアウト用の入れ物）を取り除く
 * ・インデントの空白と空行をたたむ
 *
 * class の付いた div は既存ページの構造に必要なため、そのまま残します。
 *
 * @param string $html plain モードで出力された本文HTML。
 * @return string
 */
function abc_preview_tidy( $html ) {
	$doc = new DOMDocument();

	libxml_use_internal_errors( true );
	$doc->loadHTML(
		'<?xml encoding="UTF-8">' . '<div id="abc-root">' . $html . '</div>',
		LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
	);
	libxml_clear_errors();

	// 属性のない div は、中身を残して取り除く（内側から処理する）
	$xpath = new DOMXPath( $doc );
	$divs  = iterator_to_array( $xpath->query( '//div[not(@*)]' ) );

	foreach ( array_reverse( $divs ) as $div ) {
		while ( $div->firstChild ) {
			$div->parentNode->insertBefore( $div->firstChild, $div );
		}
		$div->parentNode->removeChild( $div );
	}

	$root = $doc->getElementById( 'abc-root' );
	$out  = '';

	foreach ( $root->childNodes as $child ) {
		$out .= $doc->saveHTML( $child );
	}

	// インデント・連続する空白・空行をたたむ
	$out = preg_replace( '/[ \t]*\R[ \t]*/u', "\n", $out );
	$out = preg_replace( '/[ \t]{2,}/u', ' ', $out );
	$out = preg_replace( '/\s+(<\/(?:p|h[1-6]|li|dt|dd|small|strong|a)>)/u', '$1', $out );
	$out = preg_replace( '/\n{2,}/u', "\n", $out );

	return trim( $out );
}

/* ------------------------------------------------------------------
 * 書き出し
 * ---------------------------------------------------------------- */
$targets = array_values(
	array_filter(
		array_slice( $argv, 1 ),
		static function ( $a ) {
			return 0 !== strpos( $a, '-' );
		}
	)
);

if ( empty( $targets ) ) {
	foreach ( glob( $theme_dir . '/inc/symptoms/*.php' ) as $file ) {
		$name = basename( $file, '.php' );
		if ( '_' !== $name[0] ) {
			$targets[] = $name;
		}
	}
}

$paste_dir = __DIR__ . '/../paste';

foreach ( array( $output_dir, $paste_dir ) as $dir ) {
	if ( ! is_dir( $dir ) ) {
		mkdir( $dir, 0755, true );
	}
}

foreach ( $targets as $slug ) {
	$data = require $theme_dir . '/inc/symptoms/' . $slug . '.php';

	$GLOBALS['abc_preview_slug']  = $slug;
	$GLOBALS['abc_preview_title'] = $data['title'] ?? $slug;

	ob_start();
	include $theme_dir . '/page-symptom.php';
	$html = ob_get_clean();

	file_put_contents( $output_dir . '/' . $slug . '.html', $html );
	printf( "preview/%s.html  （表示確認用 / %d bytes）\n", $slug, strlen( $html ) );

	// 本文だけを切り出し、ブロックエディタ貼り付け用として保存する
	if ( preg_match( '#<section class="content_full">.*</section>#s', $html, $m ) ) {
		$fragment = '<!-- ABCカイロプラクティック整体院 症状ページ：' . ( $data['title'] ?? $slug ) . " -->\n"
			. "<!-- 固定ページの編集画面でブロック「カスタムHTML」を追加し、このまま貼り付けてください -->\n"
			. "<!-- ※CSSは「外観 → カスタマイズ → 追加CSS」に symptom.css の内容を1度だけ貼り付けてください -->\n"
			. abc_preview_tidy( $m[0] ) . "\n";
		file_put_contents( $paste_dir . '/' . $slug . '.html', $fragment );
		printf( "paste/%s.html        （貼り付け用 / %d bytes）\n", $slug, strlen( $fragment ) );
	}
}
