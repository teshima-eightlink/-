<?php
/**
 * 症状ページ 共通ロジック
 *
 * ・共通設定と症状データの読み込み
 * ・テンプレートから使う表示ヘルパー
 * ・CSS の読み込み
 * ・構造化データ（JSON-LD）の出力
 *
 * このファイルは基本的に触る必要はありません。
 * 文章を直すときは inc/symptoms/〇〇.php を、
 * 院の情報を直すときは inc/symptom-config.php を編集してください。
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 共通設定を取得する（初回のみ読み込み、以降はキャッシュ）。
 *
 * @return array
 */
function abc_symptom_config() {
	static $config = null;

	if ( null === $config ) {
		$config = require __DIR__ . '/symptom-config.php';

		/**
		 * 共通設定を差し替えるためのフィルター。
		 * 例）本番と検証環境で電話番号を変えたい場合などに使えます。
		 */
		if ( function_exists( 'apply_filters' ) ) {
			$config = apply_filters( 'abc_symptom_config', $config );
		}
	}

	return $config;
}

/**
 * 表示中の固定ページに対応する症状スラッグを決める。
 *
 * 1. カスタムフィールド symptom_slug があればそれを使う
 * 2. なければ固定ページのスラッグをそのまま使う
 *
 * @return string
 */
function abc_symptom_current_slug() {
	$post_id = get_queried_object_id();

	$custom = get_post_meta( $post_id, 'symptom_slug', true );
	if ( ! empty( $custom ) ) {
		return sanitize_key( $custom );
	}

	$post = get_post( $post_id );

	return $post ? sanitize_key( $post->post_name ) : '';
}

/**
 * 症状データを読み込む。
 *
 * @param string $slug 症状スラッグ（= データファイル名）。
 * @return array|null 見つからなければ null。
 */
function abc_symptom_load( $slug ) {
	$slug = sanitize_key( $slug );

	if ( '' === $slug ) {
		return null;
	}

	$file = __DIR__ . '/symptoms/' . $slug . '.php';

	if ( ! is_readable( $file ) ) {
		return null;
	}

	$data = require $file;

	return is_array( $data ) ? $data : null;
}

/**
 * 多次元配列から安全に値を取り出す。
 *
 * 例: abc_symptom_get( $data, 'empathy.heading', '' )
 *
 * @param array  $data    対象の配列。
 * @param string $path    ドット区切りのキー。
 * @param mixed  $default 見つからなかった場合の値。
 * @return mixed
 */
function abc_symptom_get( $data, $path, $default = '' ) {
	$value = $data;

	foreach ( explode( '.', $path ) as $key ) {
		if ( ! is_array( $value ) || ! array_key_exists( $key, $value ) ) {
			return $default;
		}
		$value = $value[ $key ];
	}

	return ( null === $value || '' === $value ) ? $default : $value;
}

/**
 * リンク先を URL に整える。'/case/' のような相対パスはサイトURLを補う。
 *
 * @param string $url 設定値。
 * @return string 空の設定なら空文字。
 */
function abc_symptom_url( $url ) {
	$url = trim( (string) $url );

	if ( '' === $url ) {
		return '';
	}

	if ( preg_match( '#^(https?:)?//#i', $url ) ) {
		return esc_url( $url );
	}

	return esc_url( home_url( $url ) );
}

/**
 * 電話番号を tel: リンク用に整形する。
 *
 * @param string $tel 表示用の電話番号。
 * @return string
 */
function abc_symptom_tel_href( $tel ) {
	return 'tel:' . preg_replace( '/[^0-9+]/', '', (string) $tel );
}

/**
 * セクション見出しに添える通し番号ラベル。
 *
 * @param int    $number 番号。
 * @param string $label  ラベル（悩み・原因 など）。
 * @return string エスケープ済みHTML。
 */
function abc_symptom_step_label( $number, $label ) {
	return sprintf(
		'<span class="abc-symptom__step"><span class="abc-symptom__step-num">%02d</span><span class="abc-symptom__step-text">%s</span></span>',
		(int) $number,
		esc_html( $label )
	);
}

/**
 * 症状ページ用の CSS を出力する。
 *
 * functions.php で 'abc-symptom' として wp_enqueue_style 済みの場合は
 * 二重読み込みを避けて何もしません（README の「読み込み方法B」参照）。
 */
function abc_symptom_styles() {
	static $done = false;

	if ( $done ) {
		return;
	}
	$done = true;

	if ( function_exists( 'wp_style_is' ) && wp_style_is( 'abc-symptom', 'enqueued' ) ) {
		return;
	}

	$css = dirname( __DIR__ ) . '/assets/css/symptom.css';

	if ( is_readable( $css ) ) {
		echo "\n<style id=\"abc-symptom-css\">\n" . file_get_contents( $css ) . "\n</style>\n"; // phpcs:ignore
	}
}

/**
 * 構造化データ（JSON-LD）を出力する。
 *
 * データに faq がある場合のみ FAQPage も併記します。
 *
 * @param array $data   症状データ。
 * @param array $config 共通設定。
 */
function abc_symptom_schema( $data, $config ) {
	$url   = get_permalink();
	$title = abc_symptom_get( $data, 'title', get_the_title() );

	$graph = array(
		array(
			'@type'       => 'WebPage',
			'@id'         => $url,
			'url'         => $url,
			'name'        => $title . '｜' . abc_symptom_get( $config, 'clinic.name', '' ),
			'description' => abc_symptom_get( $data, 'seo.description', '' ),
			'inLanguage'  => 'ja',
		),
	);

	$faq = abc_symptom_get( $data, 'faq', array() );

	if ( ! empty( $faq ) ) {
		$entities = array();

		foreach ( $faq as $item ) {
			$entities[] = array(
				'@type'          => 'Question',
				'name'           => $item['q'],
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $item['a'],
				),
			);
		}

		$graph[] = array(
			'@type'      => 'FAQPage',
			'mainEntity' => $entities,
		);
	}

	$json = wp_json_encode(
		array(
			'@context' => 'https://schema.org',
			'@graph'   => $graph,
		),
		JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
	);

	echo "\n<script type=\"application/ld+json\">" . $json . "</script>\n"; // phpcs:ignore
}
