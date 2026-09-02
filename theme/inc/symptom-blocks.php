<?php
/**
 * 症状ページ・姿勢改善ページで共通して使う表示パーツ
 *
 * 見た目のあるパーツはすべてここに集約しています。
 * 新しいページを作るときは、この関数を呼ぶ順番を変えるだけで組み立てられます。
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-loader.php';

/**
 * チェックリスト（枠付きの箇条書き）
 *
 * @param array $items 各行のテキスト。
 */
function abc_block_checklist( $items ) {
	if ( empty( $items ) ) {
		return;
	}
	echo '<ul class="symptom__check">';
	foreach ( $items as $item ) {
		printf( '<li>%s</li>', wp_kses_post( $item ) );
	}
	echo '</ul>';
}

/**
 * 番号付きカード（横並び）
 *
 * @param array $cards array( array( 'title', 'body' ) )
 */
function abc_block_cards( $cards ) {
	if ( empty( $cards ) ) {
		return;
	}
	echo '<div class="symptom__cause-inner">';
	foreach ( $cards as $i => $card ) {
		printf(
			'<div class="symptom__cause-box"><h3><span class="symptom__num">%d</span>%s</h3><p>%s</p></div>',
			$i + 1,
			esc_html( $card['title'] ),
			wp_kses_post( $card['body'] )
		);
	}
	echo '</div>';
}

/**
 * タイル（罫線でつないだ格子）
 *
 * 項目数は3列・2列・1列のいずれでも割り切れる数（3・6・9…）にしてください。
 * 割り切れないと最終行に空きマスができます。
 *
 * @param array $tiles array( array( 'title', 'body' ) )
 */
function abc_block_tiles( $tiles ) {
	if ( empty( $tiles ) ) {
		return;
	}
	echo '<div class="symptom__check-inner">';
	foreach ( $tiles as $tile ) {
		printf(
			'<div class="symptom__check-box"><h3>%s</h3><p>%s</p></div>',
			esc_html( $tile['title'] ),
			wp_kses_post( $tile['body'] )
		);
	}
	echo '</div>';
}

/**
 * ステップ（STEP1・2・3…の縦並び）
 *
 * @param array $steps array( array( 'title', 'body' ) )
 */
function abc_block_steps( $steps ) {
	if ( empty( $steps ) ) {
		return;
	}
	echo '<ol class="symptom__step">';
	foreach ( $steps as $step ) {
		printf(
			'<li><h3>%s</h3><p>%s</p></li>',
			esc_html( $step['title'] ),
			wp_kses_post( $step['body'] )
		);
	}
	echo '</ol>';
}

/**
 * 段落（複数）
 *
 * @param array|string $paragraphs 段落の配列、または1つの文字列。
 */
function abc_block_text( $paragraphs ) {
	foreach ( (array) $paragraphs as $p ) {
		if ( '' !== trim( (string) $p ) ) {
			printf( '<p>%s</p>', wp_kses_post( $p ) );
		}
	}
}

/**
 * 結論（水色の囲み）
 *
 * @param string $text 本文。
 */
function abc_block_conclusion( $text ) {
	if ( $text ) {
		printf( '<p class="symptom__conclusion">%s</p>', wp_kses_post( $text ) );
	}
}

/**
 * 注意書き（小さいグレーの文字）
 *
 * @param string $text 本文。
 */
function abc_block_note( $text ) {
	if ( $text ) {
		printf( '<p class="symptom__note">%s</p>', wp_kses_post( $text ) );
	}
}

/**
 * 症例カード
 *
 * ★実在の症例のみを載せてください。架空の体験談は景品表示法に抵触します。
 *
 * @param array $cases array( array( 'meta', 'title', 'body' ) )
 */
function abc_block_cases( $cases ) {
	if ( empty( $cases ) ) {
		return;
	}
	echo '<div class="symptom__case-inner">';
	foreach ( $cases as $case ) {
		printf(
			'<div class="symptom__case-box"><p class="symptom__case-meta">%s</p><h3>%s</h3><p>%s</p></div>',
			esc_html( $case['meta'] ),
			esc_html( $case['title'] ),
			wp_kses_post( $case['body'] )
		);
	}
	echo '</div>';
}

/**
 * Before / After の写真
 *
 * 画像URLは、WordPressのメディアにアップロードしたあと、
 * その「ファイルのURL」を原稿ファイルに貼り付けてください。
 * URLが空のときは何も表示されません。
 *
 * @param array $item array( 'image', 'alt', 'caption', 'detail' )
 */
function abc_block_beforeafter( $item ) {
	$image = abc_symptom_get( $item, 'image' );

	if ( ! $image ) {
		return;
	}

	echo '<figure class="symptom__ba">';
	printf(
		'<img src="%s" alt="%s" loading="lazy" decoding="async">',
		esc_url( $image ),
		esc_attr( abc_symptom_get( $item, 'alt', '施術前と施術後の姿勢の比較' ) )
	);

	$caption = abc_symptom_get( $item, 'caption' );
	$detail  = abc_symptom_get( $item, 'detail' );

	if ( $caption || $detail ) {
		echo '<figcaption>';
		if ( $caption ) {
			printf( '<span class="symptom__ba-title">%s</span>', esc_html( $caption ) );
		}
		if ( $detail ) {
			printf( '<span class="symptom__ba-detail">%s</span>', wp_kses_post( $detail ) );
		}
		echo '</figcaption>';
	}

	echo '</figure>';
}

/**
 * 外部サイトへのリンク（別タブで開く）
 *
 * @param string $url   リンク先。
 * @param string $label ラベル。
 */
function abc_block_external_link( $url, $label ) {
	if ( ! $url ) {
		return;
	}
	printf(
		'<p class="symptom__linkbox"><a class="symptom__link" href="%s" target="_blank" rel="noopener">%s</a></p>',
		esc_url( $url ),
		esc_html( $label )
	);
}

/* ==========================================================================
   ここから下は、姿勢改善ページ専用のパーツです。
   症状ページと見た目を変えるために用意しています。
   ========================================================================== */

/**
 * ビフォー・アフターの対比（いまの状態 → 変わったあと）
 *
 * @param array $rows array( array( 'before', 'after' ) )
 */
function abc_block_compare( $rows ) {
	if ( empty( $rows ) ) {
		return;
	}
	echo '<div class="symptom__compare">';
	foreach ( $rows as $row ) {
		printf(
			'<div class="symptom__compare-row">'
				. '<p class="symptom__compare-before">%s</p>'
				. '<p class="symptom__compare-after">%s</p>'
				. '</div>',
			esc_html( $row['before'] ),
			esc_html( $row['after'] )
		);
	}
	echo '</div>';
}

/**
 * 院長の言葉（手紙のような囲み）
 *
 * @param array  $paragraphs 段落の配列。
 * @param string $closing    締めの一文（太字で表示）。
 * @param string $signature  署名。
 */
function abc_block_letter( $paragraphs, $closing = '', $signature = '' ) {
	if ( empty( $paragraphs ) ) {
		return;
	}

	echo '<div class="symptom__letter">';

	foreach ( (array) $paragraphs as $p ) {
		printf( '<p>%s</p>', wp_kses_post( $p ) );
	}

	if ( $closing ) {
		printf( '<p class="symptom__letter-closing">%s</p>', wp_kses_post( $closing ) );
	}

	if ( $signature ) {
		printf( '<p class="symptom__letter-sign">%s</p>', esc_html( $signature ) );
	}

	echo '</div>';
}

/**
 * 流れ（横並びの番号付きステップ）
 *
 * ステップとの違い：こちらは横に並び、矢印でつながります。
 * 「撮影 → 解析 → 説明」のような手順を見せるときに使います。
 *
 * @param array $steps array( array( 'title', 'body' ) )
 */
function abc_block_flow( $steps ) {
	if ( empty( $steps ) ) {
		return;
	}
	echo '<ol class="symptom__flow">';
	foreach ( $steps as $step ) {
		printf(
			'<li><span class="symptom__flow-title">%s</span><span class="symptom__flow-body">%s</span></li>',
			esc_html( $step['title'] ),
			wp_kses_post( $step['body'] )
		);
	}
	echo '</ol>';
}
