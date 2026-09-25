<?php
/**
 * 原稿に、薬機法・景品表示法で問題になりやすい表現が入っていないか検査する
 *
 * 使い方: php tools/test-wording.php
 */
declare( strict_types = 1 );

$ng = array(
	'効果の断定'   => array( '治る', '治り', '治し', '治せ', '治す', '改善します', '改善でき', '軽減します', '解消します', '効果があ', '必ず', '確実に' ),
	'医療行為'     => array( '治療', '診断し', '患者様', '患者さま' ),
	'優良誤認'     => array( '日本一', 'No.1', 'ナンバーワン', '信頼される', '根本改善' ),
	'健康食品'     => array( 'サプリメント', 'デトックス', '代謝が上が', '体質が変わ' ),
	'痩身'         => array( '痩せ', 'やせ', '脂肪が落ち', 'セルライト' ),
);

$files = array_merge(
	glob( __DIR__ . '/../theme/inc/symptoms/*.php' ),
	glob( __DIR__ . '/../theme/inc/pages/*.php' ),
	glob( __DIR__ . '/../theme/inc/posts/*.php' )
);

$hits = 0;

foreach ( $files as $file ) {
	$src = file_get_contents( $file );

	// PHPコメントは検査対象から外す（注意書きに語句そのものが出てくるため）
	$src  = preg_replace( '#/\*.*?\*/#s', '', $src );
	$src  = preg_replace( '#//.*$#m', '', $src );
	$name = basename( $file );

	foreach ( $ng as $label => $words ) {
		foreach ( $words as $w ) {
			if ( false !== mb_strpos( $src, $w ) ) {
				// 前後を抜き出して文脈を見せる
				$pos = mb_strpos( $src, $w );
				$ctx = trim( preg_replace( '/\s+/u', ' ', mb_substr( $src, max( 0, $pos - 25 ), 60 ) ) );
				printf( "✗ %-24s [%s] %s\n   … %s …\n", $name, $label, $w, $ctx );
				$hits++;
			}
		}
	}
}

printf( "\n%s\n", 0 === $hits ? '✓ 問題になりやすい表現は見つかりませんでした' : "✗ {$hits}件を確認してください" );
exit( $hits > 0 ? 1 : 0 );
