<?php
/**
 * 症状ページのショートコード [symptom]
 *
 * ▼これは何のためのもの？
 *   固定ページの本文にHTMLを直接貼り付けると、エディタの
 *   「ビジュアル／コード（テキスト）」を切り替えたときに、
 *   エディタがHTMLを整形し直して構造が壊れてしまいます。
 *
 *   本文に置くのを次の1行だけにすれば、エディタは
 *   ただの文字列としてしか扱わないため、何度切り替えても壊れません。
 *
 *       [symptom slug="kubikori-katakori"]
 *
 * ▼使い方
 *   子テーマの functions.php に、次の1行を追加してください。
 *
 *       require_once get_theme_file_path( 'inc/symptom-shortcode.php' );
 *
 *   あとは固定ページの本文に [symptom slug="スラッグ"] と書くだけです。
 *   slug を省略すると、その固定ページのスラッグが使われます。
 *
 * ▼固定ページテンプレートとの使い分け
 *   ・ページ全体が症状ページ　　　　　→ 固定ページテンプレートが簡単（本文は空）
 *   ・テーマ指定のテンプレートを使う、
 *     他の内容と組み合わせて置きたい → こちらのショートコード
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-render.php';
require_once __DIR__ . '/posture-render.php';

/**
 * [symptom slug="kubikori-katakori"] を症状ページの本文に置き換える。
 *
 * @param array $atts ショートコード属性。
 * @return string
 */
function abc_symptom_shortcode( $atts ) {
	$atts = shortcode_atts(
		array( 'slug' => '' ),
		$atts,
		'symptom'
	);

	$html = abc_symptom_render( sanitize_key( $atts['slug'] ) );

	if ( '' === $html ) {
		// 編集権限のある人にだけ、原因が分かるメッセージを出す
		if ( current_user_can( 'edit_pages' ) ) {
			return '<p>※管理者にのみ表示：症状データが見つかりません。'
				. 'inc/symptoms/ の中に、指定したスラッグと同じ名前のファイルがあるか確認してください。</p>';
		}

		return '';
	}

	return $html;
}
add_shortcode( 'symptom', 'abc_symptom_shortcode' );

/**
 * [posture] を姿勢改善ページの本文に置き換える。
 *
 * @param array $atts ショートコード属性。
 * @return string
 */
function abc_posture_shortcode( $atts ) {
	$atts = shortcode_atts( array( 'slug' => 'shisei' ), $atts, 'posture' );

	return abc_posture_render( sanitize_key( $atts['slug'] ) );
}
add_shortcode( 'posture', 'abc_posture_shortcode' );

/**
 * ショートコードを囲む <p> タグを取り除く。
 *
 * WordPress は本文に自動で段落タグを付けるため（wpautop）、
 * ショートコードだけの行が <p>[symptom …]</p> になり、
 * 置き換え後に <p> の中に <section> が入る不正な入れ子が生まれます。
 * ブラウザがそれを直そうとして、余計な空段落が出ることがあるため先に外します。
 *
 * wpautop と同じ優先度10で、あとから登録することで
 * 「wpautop のあと、ショートコード展開（優先度11）の前」に実行されます。
 *
 * @param string $content 本文。
 * @return string
 */
function abc_symptom_unwrap_shortcode( $content ) {
	return preg_replace(
		'#<p>\s*(\[(?:symptom|posture)\b[^\]]*\])\s*</p>#',
		'$1',
		$content
	);
}
add_filter( 'the_content', 'abc_symptom_unwrap_shortcode', 10 );
