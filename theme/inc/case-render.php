<?php
/**
 * 症例記事（ブログ）の本文を組み立てる
 *
 * ▼構成
 *   1 どんな方？    年代・性別・生活背景
 *   2 何に困った？  症状とお困りごと
 *   3 何が分かった？AI姿勢分析・検査でわかったこと
 *   4 何をした？    施術内容とその狙い
 *   5 どう変わった？回数ごとの経過
 *   6 写真・声      Before/After とお客様のコメント
 *   7 院長コメント  似た悩みの方へ
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-blocks.php';

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
	abc_symptom_styles();
	?>
<section class="<?php echo esc_attr( abc_symptom_get( $config, 'wrapper.outer', 'content_full' ) ); ?>">
	<div class="<?php echo esc_attr( abc_symptom_get( $config, 'wrapper.inner', 'content_inner inner symptom__inner' ) ); ?>">

		<?php if ( abc_symptom_get( $data, 'lead' ) ) : ?>
			<p class="symptom__lead"><?php echo wp_kses_post( $data['lead'] ); ?></p>
		<?php endif; ?>

		<?php /* ===== 1 どんな方？ ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'profile.heading', 'どんな方が来院されたか' ) ); ?></h2>
			<?php
			abc_block_profile( abc_symptom_get( $data, 'profile.rows', array() ) );
			abc_block_text( abc_symptom_get( $data, 'profile.body', '' ) );
			?>
		</div>

		<?php /* ===== 2 何に困った？ ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'trouble.heading', '何にお困りだったか' ) ); ?></h2>
			<?php
			abc_block_text( abc_symptom_get( $data, 'trouble.body', '' ) );
			abc_block_checklist( abc_symptom_get( $data, 'trouble.items', array() ) );
			abc_block_quote(
				abc_symptom_get( $data, 'trouble.quote' ),
				abc_symptom_get( $data, 'trouble.quote_who' )
			);
			?>
		</div>

		<?php /* ===== 3 何が分かった？ ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'findings.heading', '検査でわかったこと' ) ); ?></h2>
			<?php
			abc_block_text( abc_symptom_get( $data, 'findings.body', '' ) );
			abc_block_tiles( abc_symptom_get( $data, 'findings.tiles', array() ) );
			abc_block_conclusion( abc_symptom_get( $data, 'findings.closing' ) );
			?>
		</div>

		<?php /* ===== 4 何をした？ ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'approach.heading', '行った施術と、その狙い' ) ); ?></h2>
			<?php
			abc_block_text( abc_symptom_get( $data, 'approach.body', '' ) );
			abc_block_steps( abc_symptom_get( $data, 'approach.steps', array() ) );
			?>
		</div>

		<?php /* ===== 5 どう変わった？ ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'progress.heading', '経過' ) ); ?></h2>
			<?php
			abc_block_timeline( abc_symptom_get( $data, 'progress.items', array() ) );
			abc_block_note( abc_symptom_get( $data, 'progress.note' ) );
			?>
		</div>

		<?php /* ===== 6 写真・声 ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'evidence.heading', 'Before / After とご感想' ) ); ?></h2>
			<?php
			foreach ( abc_symptom_get( $data, 'evidence.items', array() ) as $item ) {
				abc_block_beforeafter( $item );
			}
			abc_block_quote(
				abc_symptom_get( $data, 'evidence.quote' ),
				abc_symptom_get( $data, 'evidence.quote_who' )
			);
			abc_block_profile( abc_symptom_get( $data, 'evidence.terms', array() ) );
			abc_block_note( abc_symptom_get( $data, 'evidence.note' ) );
			?>
		</div>

		<?php /* ===== 7 院長コメント ===== */ ?>
		<div class="symptom__box">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'comment.heading', '似たお悩みの方へ' ) ); ?></h2>
			<?php
			abc_block_letter(
				abc_symptom_get( $data, 'comment.body', array() ),
				abc_symptom_get( $data, 'comment.closing' ),
				abc_symptom_get( $data, 'comment.signature' )
			);
			?>
		</div>

		<?php /* ===== ご予約 ===== */ ?>
		<div class="symptom__cta">
			<h2><?php echo esc_html( abc_symptom_get( $data, 'cta.heading', 'ご相談ください' ) ); ?></h2>
			<?php
			abc_block_text( abc_symptom_get( $data, 'cta.lead', '' ) );

			abc_symptom_render_buttons(
				array(
					array(
						'url'      => abc_symptom_get( $cta, 'line_url' ) ? abc_symptom_url( $cta['line_url'] ) : '',
						'text'     => 'LINEで予約・相談する',
						'note'     => abc_symptom_get( $cta, 'line_note' ),
						'modifier' => 'line',
						'blank'    => true,
					),
				)
			);
			?>
		</div>

		<?php if ( abc_symptom_get( $config, 'disclaimer' ) ) : ?>
			<p class="symptom__disclaimer"><?php echo esc_html( $config['disclaimer'] ); ?></p>
		<?php endif; ?>

	</div>
</section>
	<?php
	return ob_get_clean();
}
