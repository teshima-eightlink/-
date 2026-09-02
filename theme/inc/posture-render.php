<?php
/**
 * 姿勢改善ページの本文を組み立てる
 *
 * 表示パーツは症状ページと共通（inc/symptom-blocks.php）です。
 * このファイルは「どのパーツを、どの順番で出すか」だけを決めています。
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-blocks.php';

/**
 * 姿勢改善ページの本文HTMLを返す。
 *
 * @param string $slug 原稿ファイル名（inc/pages/ の中）。
 * @return string 見つからなければ空文字。
 */
function abc_posture_render( $slug = 'shisei' ) {
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

		<?php /* ============ 冒頭 ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'hero.voices', array() ) ) : ?>
			<ul class="symptom__voice-inner">
				<?php foreach ( $data['hero']['voices'] as $voice ) : ?>
					<li class="symptom__voice"><?php echo esc_html( $voice ); ?></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>

		<?php if ( abc_symptom_get( $data, 'hero.lead' ) ) : ?>
			<p class="symptom__lead"><?php echo wp_kses_post( $data['hero']['lead'] ); ?></p>
		<?php endif; ?>

		<?php /* ============ 01 姿勢が変わると生活がどう変わる？ ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'life.cards', array() ) ) : ?>
			<div class="symptom__box" id="life">
				<?php
				abc_symptom_heading( $data['life'] );
				abc_block_cards( $data['life']['cards'] );
				abc_block_conclusion( abc_symptom_get( $data, 'life.closing' ) );
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 02 ABCが姿勢を重視する理由 ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'reason.heading' ) ) : ?>
			<div class="symptom__box" id="reason">
				<?php
				abc_symptom_heading( $data['reason'] );
				abc_block_text( abc_symptom_get( $data, 'reason.body', array() ) );
				abc_block_conclusion( abc_symptom_get( $data, 'reason.closing' ) );
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 03 AI姿勢分析とは ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'ai.tiles', array() ) ) : ?>
			<div class="symptom__box" id="ai">
				<?php
				abc_symptom_heading( $data['ai'] );
				abc_block_tiles( $data['ai']['tiles'] );
				abc_block_text( abc_symptom_get( $data, 'ai.closing' ) );
				abc_block_external_link(
					abc_symptom_get( $data, 'ai.link_url' ),
					abc_symptom_get( $data, 'ai.link_label', 'くわしく見る' )
				);
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 04 施術・セルフケア ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'care.steps', array() ) ) : ?>
			<div class="symptom__box" id="care">
				<?php
				abc_symptom_heading( $data['care'] );
				abc_block_steps( $data['care']['steps'] );
				abc_block_note( abc_symptom_get( $data, 'care.note' ) );
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 05 Before / After ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'beforeafter.heading' ) ) : ?>
			<div class="symptom__box" id="beforeafter">
				<?php
				abc_symptom_heading( $data['beforeafter'] );
				foreach ( abc_symptom_get( $data, 'beforeafter.items', array() ) as $item ) {
					abc_block_beforeafter( $item );
				}
				abc_block_note( abc_symptom_get( $data, 'beforeafter.note' ) );
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 06 関連症例・患者様の声 ============ */ ?>
		<?php if ( abc_symptom_get( $data, 'cases.heading' ) ) : ?>
			<div class="symptom__box" id="cases">
				<?php
				abc_symptom_heading( $data['cases'] );
				abc_block_cases( abc_symptom_get( $data, 'cases.items', array() ) );
				abc_symptom_link(
					abc_symptom_url( abc_symptom_get( $links, 'case' ) ),
					abc_symptom_get( $data, 'cases.link_label', '症例を見る' )
				);
				abc_block_note( '※効果の感じ方や必要な回数には個人差があります。' );
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ 07 予約・初めての方へ ============ */ ?>
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
					array(
						'url'      => abc_symptom_get( $cta, 'tel' ) ? abc_symptom_tel_href( $cta['tel'] ) : '',
						'text'     => '電話で予約する（' . abc_symptom_get( $cta, 'tel' ) . '）',
						'note'     => abc_symptom_get( $cta, 'tel_note' ),
						'modifier' => 'tel',
					),
					array(
						'url'      => abc_symptom_get( $cta, 'web_url' ) ? abc_symptom_url( $cta['web_url'] ) : '',
						'text'     => 'Webで予約する',
						'note'     => abc_symptom_get( $cta, 'web_note' ),
						'modifier' => 'web',
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
