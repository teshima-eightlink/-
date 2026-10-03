<?php
/**
 * お悩み別（症状一覧）ページの本文を組み立てる
 *
 * 表示パーツは症状ページと共通（inc/symptom-blocks.php）です。
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-blocks.php';

/**
 * 症状一覧ページの本文HTMLを返す。
 *
 * @param string $slug 原稿ファイル名（inc/pages/ の中）。
 * @return string
 */
function abc_index_render( $slug = 'symptoms' ) {
	$file = __DIR__ . '/pages/' . sanitize_key( $slug ) . '.php';

	if ( ! is_readable( $file ) ) {
		return '';
	}

	$data = require $file;

	if ( ! is_array( $data ) ) {
		return '';
	}

	$config = abc_symptom_config();
	$cta    = $config['cta'];
	$links  = $config['links'];

	ob_start();

	abc_symptom_styles();
	abc_symptom_schema( $data, $config );
	?>
<section class="<?php echo esc_attr( abc_symptom_get( $config, 'wrapper.outer', 'content_full' ) ); ?>">
	<div class="<?php echo esc_attr( abc_symptom_get( $config, 'wrapper.inner', 'content_inner inner symptom__inner' ) ); ?>">

		<?php if ( abc_symptom_get( $data, 'hero.catch' ) ) : ?>
			<p class="symptom__catch"><?php echo esc_html( $data['hero']['catch'] ); ?></p>
		<?php endif; ?>

		<?php if ( abc_symptom_get( $data, 'hero.lead' ) ) : ?>
			<p class="symptom__lead"><?php echo wp_kses_post( $data['hero']['lead'] ); ?></p>
		<?php endif; ?>

		<?php /* ============ 症状カード ============ */ ?>
		<div class="symptom__box" id="symptoms">
			<?php
			abc_block_symptom_links( abc_symptom_get( $data, 'items', array() ) );
			abc_block_note( abc_symptom_get( $data, 'note' ) );
			?>
		</div>

		<?php /* ============ 姿勢改善への導線 ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'closing.heading' ) ) : ?>
			<div class="symptom__box" id="posture">
				<?php
				abc_symptom_heading( $data['closing'] );
				abc_block_text( abc_symptom_get( $data, 'closing.body', array() ) );
				abc_block_conclusion( abc_symptom_get( $data, 'closing.conclusion' ) );
				abc_symptom_link(
					abc_symptom_url( abc_symptom_get( $links, 'posture' ) ),
					abc_symptom_get( $data, 'closing.link_label', '姿勢改善について見る' )
				);
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ ご予約 ============ */ ?>
		<div class="symptom__cta" id="reserve">
			<?php abc_symptom_heading( abc_symptom_get( $data, 'cta', array() ) ); ?>

			<?php
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

			abc_symptom_clinic_info( $config['clinic'] );
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
