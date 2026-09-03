<?php
/**
 * 症例記事（ブログ）の本文を組み立てる
 *
 * ▼このファイルの方針：CSSを一切使いません
 *   ブログ記事は毎回HTMLを直接編集するため、クラス名や独自CSSがあると
 *   書き換えが大変になり、CSSを貼り忘れたときに崩れます。
 *   そこで h2 / p / ul / ol / blockquote / strong だけで組み立てています。
 *   見た目はテーマ（STORY）の記事スタイルがそのまま適用されます。
 *
 * ▼構成
 *   1 どんな方？ 2 何に困った？ 3 何が分かった？ 4 何をした？
 *   5 どう変わった？ 6 写真・声 7 院長コメント
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-loader.php';

/**
 * 「項目名：内容」の箇条書きを出す。
 *
 * @param array $rows array( '項目名' => '内容' )
 */
function abc_case_deflist( $rows ) {
	$rows = array_filter( (array) $rows );

	if ( empty( $rows ) ) {
		return;
	}

	echo '<ul>';
	foreach ( $rows as $label => $value ) {
		printf( '<li><strong>%s</strong>：%s</li>', esc_html( $label ), wp_kses_post( $value ) );
	}
	echo '</ul>';
}

/**
 * 「見出し：説明」の箇条書きを出す。
 *
 * @param array  $items array( array( 'title'|'label', 'body' ) )
 * @param string $key   'title' または 'label'。
 */
function abc_case_list( $items, $key = 'title' ) {
	if ( empty( $items ) ) {
		return;
	}

	echo '<ul>';
	foreach ( $items as $item ) {
		printf( '<li><strong>%s</strong>：%s</li>', esc_html( $item[ $key ] ), wp_kses_post( $item['body'] ) );
	}
	echo '</ul>';
}

/**
 * 段落を出す。
 *
 * @param array|string $paragraphs 段落。
 */
function abc_case_text( $paragraphs ) {
	foreach ( (array) $paragraphs as $p ) {
		if ( '' !== trim( (string) $p ) ) {
			printf( '<p>%s</p>', wp_kses_post( $p ) );
		}
	}
}

/**
 * 注意書きを出す（小さい文字）。
 *
 * @param string $text 本文。
 */
function abc_case_note( $text ) {
	if ( $text ) {
		printf( '<p><small>%s</small></p>', wp_kses_post( $text ) );
	}
}

/**
 * 症例記事の本文HTMLを返す。
 *
 * @param string $slug 原稿ファイル名（inc/posts/ の中）。
 * @return string
 */
function abc_case_render( $slug ) {
	$file = __DIR__ . '/posts/' . $slug . '.php';

	if ( ! is_readable( $file ) ) {
		return '';
	}

	$data = require $file;

	if ( ! is_array( $data ) ) {
		return '';
	}

	$config = abc_symptom_config();
	$cta    = $config['cta'];

	ob_start();

	abc_case_text( abc_symptom_get( $data, 'lead', '' ) );

	// めまい・しびれなど、医療機関の受診をすすめたい記事で使います
	abc_case_note( abc_symptom_get( $data, 'caution_top' ) );

	/* ===== 1 どんな方？ ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'profile.heading', 'どんな方が来院されたか' ) ) );
	abc_case_deflist( abc_symptom_get( $data, 'profile.rows', array() ) );
	abc_case_text( abc_symptom_get( $data, 'profile.body', '' ) );

	/* ===== 2 何に困った？ ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'trouble.heading', '何にお困りだったか' ) ) );
	abc_case_text( abc_symptom_get( $data, 'trouble.body', '' ) );

	if ( abc_symptom_get( $data, 'trouble.items', array() ) ) {
		echo '<ul>';
		foreach ( $data['trouble']['items'] as $item ) {
			printf( '<li>%s</li>', wp_kses_post( $item ) );
		}
		echo '</ul>';
	}

	if ( abc_symptom_get( $data, 'trouble.quote' ) ) {
		printf( '<blockquote><p>%s</p></blockquote>', wp_kses_post( $data['trouble']['quote'] ) );
	}

	/* ===== 3 何が分かった？ ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'findings.heading', 'AI姿勢分析と検査でわかったこと' ) ) );
	abc_case_text( abc_symptom_get( $data, 'findings.body', '' ) );
	abc_case_list( abc_symptom_get( $data, 'findings.tiles', array() ) );

	if ( abc_symptom_get( $data, 'findings.closing' ) ) {
		printf( '<p><strong>%s</strong></p>', wp_kses_post( $data['findings']['closing'] ) );
	}

	/* ===== 4 何をした？ ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'approach.heading', '行った施術と、その狙い' ) ) );
	abc_case_text( abc_symptom_get( $data, 'approach.body', '' ) );

	if ( abc_symptom_get( $data, 'approach.steps', array() ) ) {
		echo '<ol>';
		foreach ( $data['approach']['steps'] as $step ) {
			printf(
				'<li><strong>%s</strong><br>%s</li>',
				esc_html( $step['title'] ),
				wp_kses_post( $step['body'] )
			);
		}
		echo '</ol>';
	}

	/* ===== 5 どう変わった？ ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'progress.heading', '経過' ) ) );
	abc_case_list( abc_symptom_get( $data, 'progress.items', array() ), 'label' );
	abc_case_note( abc_symptom_get( $data, 'progress.note' ) );

	/* ===== 6 写真・声 ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'evidence.heading', 'Before / After とご感想' ) ) );

	foreach ( abc_symptom_get( $data, 'evidence.items', array() ) as $item ) {
		$image = abc_symptom_get( $item, 'image' );

		if ( $image ) {
			printf(
				'<p><img src="%s" alt="%s"></p>',
				esc_url( $image ),
				esc_attr( abc_symptom_get( $item, 'alt', '施術前と施術後の姿勢の比較' ) )
			);
		} else {
			// 画像は編集画面の「メディアを追加」から挿入してください
			echo "\n<!-- ▼ここにBefore/Afterの画像を挿入してください（メディアを追加）▼ -->\n";
		}

		abc_case_text( abc_symptom_get( $item, 'detail', '' ) );
	}

	if ( abc_symptom_get( $data, 'evidence.quote' ) ) {
		printf( '<blockquote><p>%s</p></blockquote>', wp_kses_post( $data['evidence']['quote'] ) );

		if ( abc_symptom_get( $data, 'evidence.quote_who' ) ) {
			printf( '<p><small>（%s）</small></p>', esc_html( $data['evidence']['quote_who'] ) );
		}
	}

	abc_case_deflist( abc_symptom_get( $data, 'evidence.terms', array() ) );
	abc_case_note( abc_symptom_get( $data, 'evidence.note' ) );

	/* ===== 7 院長コメント ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'comment.heading', '似たお悩みの方へ' ) ) );
	abc_case_text( abc_symptom_get( $data, 'comment.body', array() ) );

	if ( abc_symptom_get( $data, 'comment.closing' ) ) {
		printf( '<p><strong>%s</strong></p>', wp_kses_post( $data['comment']['closing'] ) );
	}

	if ( abc_symptom_get( $data, 'comment.signature' ) ) {
		printf( '<p>%s</p>', esc_html( $data['comment']['signature'] ) );
	}

	/* ===== ご予約 ===== */
	printf( '<h2>%s</h2>', esc_html( abc_symptom_get( $data, 'cta.heading', 'ご相談ください' ) ) );
	abc_case_text( abc_symptom_get( $data, 'cta.lead', '' ) );

	if ( abc_symptom_get( $cta, 'line_url' ) ) {
		printf(
			'<p><a href="%s" target="_blank" rel="noopener">LINEで予約・相談する</a></p>',
			esc_url( abc_symptom_url( $cta['line_url'] ) )
		);
	}

	// 全記事共通の院紹介文（inc/symptom-config.php の post_footer）
	abc_case_text( abc_symptom_get( $config, 'post_footer', '' ) );

	abc_case_note( abc_symptom_get( $config, 'disclaimer' ) );

	return ob_get_clean();
}
