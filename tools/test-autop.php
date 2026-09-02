<?php
/**
 * クラシックエディタの自動整形（wpautop）を通しても
 * 貼り付け用HTMLが壊れないかを検証する。
 * WordPress本体の wpautop と同じ手順を再現している。
 *
 * 使い方:
 *   php tools/test-autop.php                  首こり・肩こりを検証
 *   php tools/test-autop.php yotsu            指定した症状を検証
 *
 * 原稿を書き換えて paste/ を作り直したあとに、必ず実行してください。
 */
declare( strict_types = 1 );

function wp_autop( string $pee, bool $br = true ): string {
	if ( trim( $pee ) === '' ) {
		return '';
	}
	$pee = $pee . "\n";
	$allblocks = '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)';
	$pee = preg_replace( '!(<' . $allblocks . '[^>]*>)!', "\n$1", $pee );
	$pee = preg_replace( '!(</' . $allblocks . '>)!', "$1\n\n", $pee );
	$pee = str_replace( array( "\r\n", "\r" ), "\n", $pee );
	$pee = preg_replace( "/\n\n+/", "\n\n", $pee );
	$pees = preg_split( '/\n\s*\n/', $pee, -1, PREG_SPLIT_NO_EMPTY );
	$pee  = '';
	foreach ( $pees as $tinkle ) {
		$pee .= '<p>' . trim( $tinkle, "\n" ) . "</p>\n";
	}
	$pee = preg_replace( '|<p>\s*</p>|', '', $pee );
	$pee = preg_replace( '!<p>([^<]+)</(div|address|form)>!', '<p>$1</p></$2>', $pee );
	$pee = preg_replace( '!<p>\s*(</?' . $allblocks . '[^>]*>)\s*</p>!', '$1', $pee );
	$pee = preg_replace( '!<p>\s*(</?' . $allblocks . '[^>]*>)!', '$1', $pee );
	$pee = preg_replace( '!(</?' . $allblocks . '[^>]*>)\s*</p>!', '$1', $pee );
	if ( $br ) {
		$pee = preg_replace( '|(?<!<br />)\s*\n|', "<br />\n", $pee );
	}
	$pee = preg_replace( '!(</?' . $allblocks . '[^>]*>)\s*<br />!', '$1', $pee );
	$pee = preg_replace( '!<br />(\s*</?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)!', '$1', $pee );
	$pee = preg_replace( "|\n</p>$|", '</p>', $pee );
	return $pee;
}

$slug = $argv[1] ?? 'kubikori-katakori';
$src  = file_get_contents( __DIR__ . '/../paste/' . $slug . '.html' );
$after = wp_autop( $src );

$checks = array();

// 1. 意図しない改行タグが増えていないか（元から書いてある <br> は除く）
$checks['改行タグが増えていない'] = ( preg_match_all( '/<br/i', $after ) === preg_match_all( '/<br/i', $src ) );

// 2. 余計な空の <p> が生まれていないか
$checks['空の <p></p> が生まれていない'] = ( preg_match( '#<p>\s*</p>#', $after ) === 0 );

// 3. class 属性が失われていないか
preg_match_all( '/class="[^"]*"/', $src, $a );
preg_match_all( '/class="[^"]*"/', $after, $b );
$checks['class属性の数が変わらない（' . count( $a[0] ) . '個）'] = ( count( $a[0] ) === count( $b[0] ) );

// 4. <p> の中に <section> や <div> が入る不正な入れ子が無いか
$checks['<p>の中にブロック要素が入っていない'] = ( preg_match( '#<p>\s*<(section|div|ul|ol|h[1-6])#', $after ) === 0 );

// 5. 本文の文字が消えていないか
$strip = fn( $h ) => preg_replace( '/\s+/u', '', strip_tags( $h ) );
$checks['本文の文字が1文字も失われていない'] = ( $strip( $src ) === $strip( $after ) );

$ng = 0;
foreach ( $checks as $name => $ok ) {
	printf( "%s %s\n", $ok ? '✓' : '✗', $name );
	$ng += $ok ? 0 : 1;
}
printf( "\n%s\n", $ng === 0 ? '結果：wpautop を通しても崩れません' : "結果：{$ng}件の問題あり" );
exit( $ng > 0 ? 1 : 0 );
