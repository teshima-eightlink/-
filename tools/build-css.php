<?php
/**
 * WAF対応版CSSの生成ツール
 *
 * ▼なぜ必要か
 *   多くのレンタルサーバーのWAF（セキュリティ機能）は、
 *     /*  *"/   … SQLのコメント記号
 *     --        … SQLのコメント記号
 *   をSQLインジェクションの兆候として検知します。
 *   CSSのコメントとCSS変数（--symptom-accent など）がこれに一致するため、
 *   管理画面で保存・プレビューしようとすると「Forbidden access」で弾かれます。
 *
 *   そこで、
 *     ・コメントをすべて削除
 *     ・CSS変数を実際の値に展開して var() と -- を無くす
 *   したものを書き出します。見た目は元のCSSと同じです。
 *
 * ▼使い方
 *   php tools/build-css.php
 *     → paste/symptom-css.txt に書き出されます。
 *       これをテーマの「カスタムCSS」欄に貼り付けてください。
 *
 *   編集するのは常に theme/assets/css/symptom.css のほうです。
 *   直したらこのコマンドを実行し直してください。
 */

declare( strict_types = 1 );

$src_file = __DIR__ . '/../theme/assets/css/symptom.css';
$out_dir  = __DIR__ . '/../paste';
$out_file = $out_dir . '/symptom-css.txt';

$css = file_get_contents( $src_file );

/* ------------------------------------------------------------------
 * 1. CSS変数の定義を集める
 * ---------------------------------------------------------------- */
preg_match_all( '/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/mi', $css, $m, PREG_SET_ORDER );

$vars = array();
foreach ( $m as $one ) {
	$vars[ $one[1] ] = trim( $one[2] );
}

/* ------------------------------------------------------------------
 * 2. 変数の定義行を削除する
 * ---------------------------------------------------------------- */
$css = preg_replace( '/^\s*--[a-z0-9-]+\s*:\s*[^;]+;\s*$/mi', '', $css );

/* ------------------------------------------------------------------
 * 3. var(--x) を実際の値に置き換える（入れ子にも対応するため繰り返す）
 * ---------------------------------------------------------------- */
for ( $i = 0; $i < 5; $i++ ) {
	$before = $css;
	$css    = preg_replace_callback(
		'/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*))?\)/i',
		static function ( $mm ) use ( $vars ) {
			if ( isset( $vars[ $mm[1] ] ) ) {
				return $vars[ $mm[1] ];
			}
			return isset( $mm[2] ) ? trim( $mm[2] ) : 'inherit';
		},
		$css
	);
	if ( $before === $css ) {
		break;
	}
}

/* ------------------------------------------------------------------
 * 4. コメントを削除する
 * ---------------------------------------------------------------- */
$css = preg_replace( '#/\*.*?\*/#s', '', $css );

/* ------------------------------------------------------------------
 * 5. 空になったルールと余分な空白を整理する
 * ---------------------------------------------------------------- */
$css = preg_replace( '/^[ \t]+/m', '', $css );          // 行頭のインデント
$css = preg_replace( '/\n{2,}/', "\n", $css );          // 連続する空行
$css = preg_replace( '/[^{}]+\{\s*\}\n?/', '', $css );  // 中身が空になったルール
$css = trim( $css ) . "\n";

if ( ! is_dir( $out_dir ) ) {
	mkdir( $out_dir, 0755, true );
}
file_put_contents( $out_file, $css );

/* ------------------------------------------------------------------
 * 6. WAFに引っかかる記号が残っていないか確認する
 * ---------------------------------------------------------------- */
$ng = array(
	'/* */（SQLコメント記号）' => substr_count( $css, '/*' ) + substr_count( $css, '*/' ),
	'--（SQLコメント記号）'     => preg_match_all( '/--/', $css ),
	'var(）'                    => substr_count( $css, 'var(' ),
	'<（タグの記号）'           => substr_count( $css, '<' ),
	'url(（外部読み込み）'      => substr_count( $css, 'url(' ),
);

printf( "paste/symptom-css.txt を書き出しました（%d bytes）\n\n", strlen( $css ) );
echo "WAFに誤検知されやすい記号のチェック:\n";

$fail = 0;
foreach ( $ng as $label => $count ) {
	printf( "  %s %-28s %d個\n", 0 === $count ? '✓' : '✗', $label, $count );
	$fail += $count;
}

echo $fail === 0
	? "\n結果：WAFに引っかかる記号は残っていません\n"
	: "\n結果：まだ記号が残っています。上の項目を確認してください\n";

exit( $fail > 0 ? 1 : 0 );
