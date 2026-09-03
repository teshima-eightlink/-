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
 *   preview/〇〇.html   ブラウザで表示を確認するためのHTML
 *   paste/〇〇.html     クラシックエディタの本文に貼り付けるHTML
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

	/*
	 * クラシックエディタは本文を自動整形します（wpautop）。その際、
	 *   ・空行があると <p> が勝手に差し込まれる
	 *   ・文中の改行が <br /> に変換される
	 * ため、次の形に整えて事故を防ぎます。
	 *   ・空行をなくす
	 *   ・改行はタグとタグの境目にだけ置き、文の途中には入れない
	 */
	$out = preg_replace( '/\s+/u', ' ', $out );        // すべての空白を1つの半角スペースに
	$out = preg_replace( '/>\s+</u', ">\n<", $out );   // タグの境目だけ改行する

	// 編集画面で扱いやすいよう、ブロック要素の前で改行する
	// （空行は作らない。空行があると wpautop が余計な段落を差し込むため）
	$out = preg_replace( '#><(h[1-6]|p|ul|ol|li|blockquote|figure|div|section)\b#u', ">\n<$1", $out );
	$out = preg_replace( '/\s+(<\/(?:p|h[1-6]|li|dt|dd|small|strong|a)>)/u', '$1', $out );

	return trim( $out );
}

/* ------------------------------------------------------------------
 * 書き出し
 *
 * CSSは1リクエストにつき1回だけ出力する作りのため、
 * 複数ページを1プロセスで生成すると2ページ目以降にCSSが付きません。
 * そこで、ページごとに子プロセスを起動します。
 * ---------------------------------------------------------------- */
$paste_dir = __DIR__ . '/../paste';

foreach ( array( $output_dir, $paste_dir ) as $dir ) {
	if ( ! is_dir( $dir ) ) {
		mkdir( $dir, 0755, true );
	}
}

/**
 * 1ページ分を書き出す。
 *
 * @param string $slug  スラッグ（原稿ファイル名）。
 * @param string $type  'symptom' または 'posture'。
 */
function abc_preview_write( $slug, $type ) {
	global $theme_dir, $output_dir, $paste_dir;

	$body = '';
	$dirs = array(
		'posture' => '/inc/pages/',
		'case'    => '/inc/posts/',
		'symptom' => '/inc/symptoms/',
	);
	$file = $theme_dir . $dirs[ $type ] . $slug . '.php';

	$data = require $file;

	$GLOBALS['abc_preview_slug']  = $slug;
	$GLOBALS['abc_preview_title'] = $data['title'] ?? $slug;

	if ( 'posture' === $type || 'case' === $type ) {
		if ( 'posture' === $type ) {
			require_once $theme_dir . '/inc/posture-render.php';
			$body = abc_posture_render( $slug );
		} else {
			require_once $theme_dir . '/inc/case-render.php';
			$body = abc_case_render( $slug );
		}

		ob_start();
		get_header();
		echo $body;
		get_footer();
		$html = ob_get_clean();
	} else {
		ob_start();
		include $theme_dir . '/page-symptom.php';
		$html = ob_get_clean();
	}

	file_put_contents( $output_dir . '/' . $slug . '.html', $html );
	printf( "preview/%-22s （表示確認用 / %d bytes）\n", $slug . '.html', strlen( $html ) );

	// 症例記事はCSSを使わないため、本文をそのまま貼り付け用にする
	$fragment = '';

	if ( 'case' === $type ) {
		$fragment = abc_preview_tidy( $body ) . "\n";
	} elseif ( preg_match( '#<section class="content_full">.*</section>#s', $html, $m ) ) {
		$fragment = abc_preview_tidy( $m[0] ) . "\n";
	}

	if ( '' !== $fragment ) {
		file_put_contents( $paste_dir . '/' . $slug . '.html', $fragment );
		printf( "paste/%-24s （本文貼り付け用 / %d bytes）\n", $slug . '.html', strlen( $fragment ) );
	}
}

/* 対象ページの一覧をつくる */
$args = array_slice( $argv, 1 );
$one  = '';

foreach ( $args as $arg ) {
	if ( 0 === strpos( $arg, '--one=' ) ) {
		$one = substr( $arg, 6 );
	}
}

$pages = array();

foreach ( glob( $theme_dir . '/inc/pages/*.php' ) as $f ) {
	$pages[] = array( basename( $f, '.php' ), 'posture' );
}

foreach ( glob( $theme_dir . '/inc/posts/*.php' ) as $f ) {
	$pages[] = array( basename( $f, '.php' ), 'case' );
}

foreach ( glob( $theme_dir . '/inc/symptoms/*.php' ) as $f ) {
	$name = basename( $f, '.php' );
	if ( '_' !== $name[0] ) {
		$pages[] = array( $name, 'symptom' );
	}
}

/* 指定があれば絞り込む */
$filter = array_values( array_filter( $args, static fn( $a ) => 0 !== strpos( $a, '-' ) ) );

if ( $filter ) {
	$pages = array_values( array_filter( $pages, static fn( $p ) => in_array( $p[0], $filter, true ) ) );
}

/* --one が無ければ、ページごとに子プロセスを起動する */
if ( '' === $one ) {
	foreach ( $pages as list( $slug, $type ) ) {
		$cmd = escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( __FILE__ )
			. ' --one=' . escapeshellarg( $slug . ':' . $type );
		passthru( $cmd, $status );
		if ( 0 !== $status ) {
			exit( $status );
		}
	}
	exit( 0 );
}

list( $one_slug, $one_type ) = explode( ':', $one );
abc_preview_write( $one_slug, $one_type );
