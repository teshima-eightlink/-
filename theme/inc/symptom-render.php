<?php
/**
 * 症状ページの本文を組み立てる
 *
 * 固定ページテンプレート（page-symptom.php）と
 * ショートコード（[symptom]）の両方から、この関数を呼びます。
 * マークアップを1か所にまとめることで、どちらから表示しても同じ結果になります。
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/symptom-loader.php';

/**
 * 症状ページの本文HTMLを返す。
 *
 * @param string $slug 症状スラッグ。空なら表示中の固定ページから判定します。
 * @return string 見つからなければ空文字。
 */
function abc_symptom_render( $slug = '' ) {
	$abc_config = abc_symptom_config();
	$abc_data   = abc_symptom_load( '' !== $slug ? $slug : abc_symptom_current_slug() );

	if ( null === $abc_data ) {
		return '';
	}

	$abc_cta   = $abc_config['cta'];
	$abc_links = $abc_config['links'];

	ob_start();

	abc_symptom_styles();
	abc_symptom_schema( $abc_data, $abc_config );
	?>
<section class="<?php echo esc_attr( abc_symptom_get( $abc_config, 'wrapper.outer', 'content_full' ) ); ?>">
	<div class="<?php echo esc_attr( abc_symptom_get( $abc_config, 'wrapper.inner', 'content_inner inner symptom__inner' ) ); ?>">

		<?php /* ============ 冒頭 ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'hero.voices', array() ) ) : ?>
			<ul class="symptom__voice--inner">
				<?php foreach ( $abc_data['hero']['voices'] as $abc_voice ) : ?>
					<li class="symptom__voice"><?php echo esc_html( $abc_voice ); ?></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>

		<?php if ( abc_symptom_get( $abc_data, 'hero.lead' ) ) : ?>
			<p class="symptom__lead"><?php echo wp_kses_post( $abc_data['hero']['lead'] ); ?></p>
		<?php endif; ?>

		<?php /* ============ ① 共感 ─ 悩み ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'empathy.items', array() ) ) : ?>
			<div class="symptom__box" id="empathy">
				<?php abc_symptom_heading( $abc_data['empathy'] ); ?>

				<ul class="symptom__check">
					<?php foreach ( $abc_data['empathy']['items'] as $abc_item ) : ?>
						<li><?php echo esc_html( $abc_item ); ?></li>
					<?php endforeach; ?>
				</ul>

				<?php if ( abc_symptom_get( $abc_data, 'empathy.closing' ) ) : ?>
					<p class="symptom__conclusion"><?php echo wp_kses_post( $abc_data['empathy']['closing'] ); ?></p>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php /* ============ ② 解説 ─ 原因・背景 ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'cause.blocks', array() ) ) : ?>
			<div class="symptom__box" id="cause">
				<?php abc_symptom_heading( $abc_data['cause'] ); ?>

				<div class="symptom__cause--inner">
					<?php foreach ( $abc_data['cause']['blocks'] as $abc_i => $abc_block ) : ?>
						<div class="symptom__cause--box">
							<h3><span class="symptom__num"><?php echo esc_html( $abc_i + 1 ); ?></span><?php echo esc_html( $abc_block['title'] ); ?></h3>
							<p><?php echo wp_kses_post( $abc_block['body'] ); ?></p>
						</div>
					<?php endforeach; ?>
				</div>

				<?php if ( abc_symptom_get( $abc_data, 'cause.closing' ) ) : ?>
					<p class="symptom__conclusion"><?php echo wp_kses_post( $abc_data['cause']['closing'] ); ?></p>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php /* ============ ③ 評価 ─ ABCでは何を確認する？ ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'check.items', array() ) ) : ?>
			<div class="symptom__box" id="check">
				<?php abc_symptom_heading( $abc_data['check'] ); ?>

				<div class="symptom__check--inner">
					<?php foreach ( $abc_data['check']['items'] as $abc_item ) : ?>
						<div class="symptom__check--box">
							<h3><?php echo esc_html( $abc_item['title'] ); ?></h3>
							<p><?php echo wp_kses_post( $abc_item['body'] ); ?></p>
						</div>
					<?php endforeach; ?>
				</div>

				<?php if ( abc_symptom_get( $abc_data, 'check.closing' ) ) : ?>
					<p><?php echo wp_kses_post( $abc_data['check']['closing'] ); ?></p>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php /* ============ ④ 方針 ─ どう施術する？ ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'policy.steps', array() ) ) : ?>
			<div class="symptom__box" id="policy">
				<?php abc_symptom_heading( $abc_data['policy'] ); ?>

				<ol class="symptom__step">
					<?php foreach ( $abc_data['policy']['steps'] as $abc_step ) : ?>
						<li>
							<h3><?php echo esc_html( $abc_step['title'] ); ?></h3>
							<p><?php echo wp_kses_post( $abc_step['body'] ); ?></p>
						</li>
					<?php endforeach; ?>
				</ol>

				<?php if ( abc_symptom_get( $abc_data, 'policy.note' ) ) : ?>
					<p class="symptom__note"><?php echo wp_kses_post( $abc_data['policy']['note'] ); ?></p>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php /* ============ ⑤ 実例 ─ 症例ページへ ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'cases.heading' ) ) : ?>
			<div class="symptom__box" id="cases">
				<?php abc_symptom_heading( $abc_data['cases'] ); ?>

				<?php if ( abc_symptom_get( $abc_data, 'cases.items', array() ) ) : ?>
					<div class="symptom__case--inner">
						<?php foreach ( $abc_data['cases']['items'] as $abc_case ) : ?>
							<div class="symptom__case--box">
								<p class="symptom__case--meta"><?php echo esc_html( $abc_case['meta'] ); ?></p>
								<h3><?php echo esc_html( $abc_case['title'] ); ?></h3>
								<p><?php echo wp_kses_post( $abc_case['body'] ); ?></p>
							</div>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>

				<?php
				abc_symptom_link(
					abc_symptom_url( abc_symptom_get( $abc_links, 'case' ) ),
					abc_symptom_get( $abc_data, 'cases.link_label', '症例を見る' )
				);
				?>

				<p class="symptom__note">※効果の感じ方や必要な回数には個人差があります。</p>
			</div>
		<?php endif; ?>

		<?php /* ============ ⑥ 専門性 ─ 姿勢改善ページへ ============ */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'expertise.heading' ) ) : ?>
			<div class="symptom__box" id="expertise">
				<?php abc_symptom_heading( $abc_data['expertise'] ); ?>

				<?php foreach ( abc_symptom_get( $abc_data, 'expertise.body', array() ) as $abc_paragraph ) : ?>
					<p><?php echo wp_kses_post( $abc_paragraph ); ?></p>
				<?php endforeach; ?>

				<?php if ( abc_symptom_get( $abc_data, 'expertise.points', array() ) ) : ?>
					<ul class="symptom__check">
						<?php foreach ( $abc_data['expertise']['points'] as $abc_point ) : ?>
							<li><?php echo esc_html( $abc_point ); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>

				<?php
				abc_symptom_link(
					abc_symptom_url( abc_symptom_get( $abc_links, 'posture' ) ),
					abc_symptom_get( $abc_data, 'expertise.link_label', '姿勢改善について見る' )
				);
				?>
			</div>
		<?php endif; ?>

		<?php /* ============ ⑦ 行動 ─ 予約・LINE ============ */ ?>
		<div class="symptom__cta" id="reserve">
			<?php abc_symptom_heading( abc_symptom_get( $abc_data, 'cta', array() ) ); ?>

			<?php if ( abc_symptom_get( $abc_cta, 'first_price' ) ) : ?>
				<p class="symptom__price">
					<?php echo esc_html( $abc_cta['first_price'] ); ?>
					<?php if ( abc_symptom_get( $abc_cta, 'price_note' ) ) : ?>
						<span><?php echo esc_html( $abc_cta['price_note'] ); ?></span>
					<?php endif; ?>
				</p>
			<?php endif; ?>

			<?php
			abc_symptom_render_buttons(
				array(
					array(
						'url'      => abc_symptom_get( $abc_cta, 'line_url' ) ? abc_symptom_url( $abc_cta['line_url'] ) : '',
						'text'     => 'LINEで予約・相談する',
						'note'     => abc_symptom_get( $abc_cta, 'line_note' ),
						'modifier' => 'line',
						'blank'    => true,
					),
					array(
						'url'      => abc_symptom_get( $abc_cta, 'tel' ) ? abc_symptom_tel_href( $abc_cta['tel'] ) : '',
						'text'     => '電話で予約する（' . abc_symptom_get( $abc_cta, 'tel' ) . '）',
						'note'     => abc_symptom_get( $abc_cta, 'tel_note' ),
						'modifier' => 'tel',
					),
					array(
						'url'      => abc_symptom_get( $abc_cta, 'web_url' ) ? abc_symptom_url( $abc_cta['web_url'] ) : '',
						'text'     => 'Webで予約する',
						'note'     => abc_symptom_get( $abc_cta, 'web_note' ),
						'modifier' => 'web',
					),
				)
			);
			?>

			<?php abc_symptom_clinic_info( $abc_config['clinic'] ); ?>
		</div>

		<?php if ( abc_symptom_get( $abc_config, 'disclaimer' ) ) : ?>
			<p class="symptom__disclaimer"><?php echo esc_html( $abc_config['disclaimer'] ); ?></p>
		<?php endif; ?>

	</div>
</section>
	<?php
	return ob_get_clean();
}
