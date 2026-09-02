<?php
/**
 * Template Name: 症状ページ（共通テンプレート）
 * Template Post Type: page
 *
 * 症状別の固定ページを、共通のレイアウト・共通の導線で量産するためのテンプレート。
 *
 * 【表示するデータの決まり方】
 *   固定ページのスラッグ（例: kubikori-katakori）と同じ名前の
 *   inc/symptoms/kubikori-katakori.php が読み込まれます。
 *   スラッグとファイル名を変えたい場合は、固定ページのカスタムフィールドに
 *   symptom_slug = ファイル名 を設定してください。
 *
 * 【構成】 ①共感 → ②解説 → ③評価 → ④方針 → ⑤実例 → ⑥専門性 → ⑦行動
 *
 * @package ABC_Chiro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once get_theme_file_path( 'inc/symptom-loader.php' );

$abc_config = abc_symptom_config();
$abc_data   = abc_symptom_load( abc_symptom_current_slug() );

get_header();
?>

<?php if ( null === $abc_data ) : ?>

	<?php
	// データファイルが無いときは、固定ページ本文をそのまま表示して事故を防ぐ。
	abc_symptom_styles();

	while ( have_posts() ) :
		the_post();
		?>
		<main class="abc-symptom abc-symptom--fallback">
			<div class="abc-symptom__inner">
				<h1 class="abc-symptom__title"><?php the_title(); ?></h1>
				<?php the_content(); ?>
				<?php if ( current_user_can( 'edit_pages' ) ) : ?>
					<p class="abc-symptom__admin-notice">
						※管理者にのみ表示：<code>inc/symptoms/<?php echo esc_html( abc_symptom_current_slug() ); ?>.php</code>
						が見つかりません。ファイル名と固定ページのスラッグを合わせてください。
					</p>
				<?php endif; ?>
			</div>
		</main>
	<?php endwhile; ?>

<?php else : ?>

	<?php
	abc_symptom_styles();
	abc_symptom_schema( $abc_data, $abc_config );

	$abc_clinic = $abc_config['clinic'];
	$abc_cta    = $abc_config['cta'];
	$abc_links  = $abc_config['links'];
	?>

	<main class="abc-symptom" id="abc-symptom">

		<?php /* =========================================================
		 * ヒーロー（ページ導入）
		 * ====================================================== */ ?>
		<header class="abc-symptom__hero">
			<div class="abc-symptom__inner">
				<?php
				/*
				 * テーマ側がページタイトルを自動で表示する場合、ここで出すと h1 が
				 * 二重になります。その場合は原稿ファイルで 'show_title' => false に
				 * してください（見出しと院名の行だけが出力されなくなります）。
				 */
				if ( false !== abc_symptom_get( $abc_data, 'hero.show_title', true ) ) :
					?>
					<p class="abc-symptom__eyebrow">
						<?php echo esc_html( abc_symptom_get( $abc_clinic, 'area', '' ) ); ?>の整体
						<?php echo esc_html( abc_symptom_get( $abc_clinic, 'name', '' ) ); ?>
					</p>
					<h1 class="abc-symptom__title">
						<?php echo esc_html( abc_symptom_get( $abc_data, 'title', get_the_title() ) ); ?>
					</h1>
				<?php endif; ?>
				<?php if ( abc_symptom_get( $abc_data, 'hero.voices', array() ) ) : ?>
					<ul class="abc-symptom__voices">
						<?php foreach ( $abc_data['hero']['voices'] as $abc_voice ) : ?>
							<li class="abc-symptom__voice"><?php echo esc_html( $abc_voice ); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>

				<?php if ( abc_symptom_get( $abc_data, 'hero.catch' ) ) : ?>
					<p class="abc-symptom__catch"><?php echo esc_html( $abc_data['hero']['catch'] ); ?></p>
				<?php endif; ?>
				<?php if ( abc_symptom_get( $abc_data, 'hero.lead' ) ) : ?>
					<p class="abc-symptom__lead"><?php echo wp_kses_post( $abc_data['hero']['lead'] ); ?></p>
				<?php endif; ?>
			</div>
		</header>

		<?php /* =========================================================
		 * ① 共感 ─ お悩み
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'empathy.items', array() ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--empathy" id="empathy">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 1, '悩み' ); // phpcs:ignore ?>
					<?php echo esc_html( abc_symptom_get( $abc_data, 'empathy.heading' ) ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'empathy.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['empathy']['lead'] ); ?></p>
				<?php endif; ?>

				<ul class="abc-symptom__checklist">
					<?php foreach ( $abc_data['empathy']['items'] as $abc_item ) : ?>
						<li><?php echo esc_html( $abc_item ); ?></li>
					<?php endforeach; ?>
				</ul>

				<?php if ( abc_symptom_get( $abc_data, 'empathy.closing' ) ) : ?>
					<p class="abc-symptom__text abc-symptom__text--emphasis">
						<?php echo wp_kses_post( $abc_data['empathy']['closing'] ); ?>
					</p>
				<?php endif; ?>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ② 解説 ─ 原因・背景
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'cause.blocks', array() ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--cause" id="cause">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 2, '原因・背景' ); // phpcs:ignore ?>
					<?php echo esc_html( abc_symptom_get( $abc_data, 'cause.heading' ) ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'cause.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['cause']['lead'] ); ?></p>
				<?php endif; ?>

				<div class="abc-symptom__cards">
					<?php foreach ( $abc_data['cause']['blocks'] as $abc_i => $abc_block ) : ?>
						<div class="abc-symptom__card">
							<h3 class="abc-symptom__card-title">
								<span class="abc-symptom__card-num"><?php echo esc_html( $abc_i + 1 ); ?></span>
								<?php echo esc_html( $abc_block['title'] ); ?>
							</h3>
							<p class="abc-symptom__card-body"><?php echo wp_kses_post( $abc_block['body'] ); ?></p>
						</div>
					<?php endforeach; ?>
				</div>

				<?php if ( abc_symptom_get( $abc_data, 'cause.closing' ) ) : ?>
					<p class="abc-symptom__conclusion">
						<?php echo wp_kses_post( $abc_data['cause']['closing'] ); ?>
					</p>
				<?php endif; ?>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ③ 評価 ─ ABCは何を見る？
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'check.items', array() ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--check" id="check">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 3, 'ABCは何を見る？' ); // phpcs:ignore ?>
					<?php echo esc_html( abc_symptom_get( $abc_data, 'check.heading' ) ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'check.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['check']['lead'] ); ?></p>
				<?php endif; ?>

				<ol class="abc-symptom__list">
					<?php foreach ( $abc_data['check']['items'] as $abc_item ) : ?>
						<li class="abc-symptom__list-item">
							<h3 class="abc-symptom__list-title"><?php echo esc_html( $abc_item['title'] ); ?></h3>
							<p class="abc-symptom__list-body"><?php echo wp_kses_post( $abc_item['body'] ); ?></p>
						</li>
					<?php endforeach; ?>
				</ol>

				<?php if ( abc_symptom_get( $abc_data, 'check.closing' ) ) : ?>
					<p class="abc-symptom__conclusion">
						<?php echo wp_kses_post( $abc_data['check']['closing'] ); ?>
					</p>
				<?php endif; ?>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ④ 方針 ─ どう施術する？
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'policy.steps', array() ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--policy" id="policy">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 4, 'どう施術する？' ); // phpcs:ignore ?>
					<?php echo esc_html( abc_symptom_get( $abc_data, 'policy.heading' ) ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'policy.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['policy']['lead'] ); ?></p>
				<?php endif; ?>

				<div class="abc-symptom__steps">
					<?php foreach ( $abc_data['policy']['steps'] as $abc_i => $abc_step ) : ?>
						<div class="abc-symptom__step-item">
							<div class="abc-symptom__step-badge">STEP <?php echo esc_html( $abc_i + 1 ); ?></div>
							<div class="abc-symptom__step-content">
								<h3 class="abc-symptom__step-title"><?php echo esc_html( $abc_step['title'] ); ?></h3>
								<p class="abc-symptom__step-body"><?php echo wp_kses_post( $abc_step['body'] ); ?></p>
							</div>
						</div>
					<?php endforeach; ?>
				</div>

				<?php if ( abc_symptom_get( $abc_data, 'policy.note' ) ) : ?>
					<p class="abc-symptom__note"><?php echo wp_kses_post( $abc_data['policy']['note'] ); ?></p>
				<?php endif; ?>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ⑤ 実例 ─ 症例ページへ
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'cases.heading' ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--cases" id="cases">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 5, '実例' ); // phpcs:ignore ?>
					<?php echo esc_html( $abc_data['cases']['heading'] ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'cases.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['cases']['lead'] ); ?></p>
				<?php endif; ?>

				<?php if ( abc_symptom_get( $abc_data, 'cases.items', array() ) ) : ?>
					<div class="abc-symptom__cases">
						<?php foreach ( $abc_data['cases']['items'] as $abc_case ) : ?>
							<article class="abc-symptom__case">
								<p class="abc-symptom__case-meta"><?php echo esc_html( $abc_case['meta'] ); ?></p>
								<h3 class="abc-symptom__case-title"><?php echo esc_html( $abc_case['title'] ); ?></h3>
								<p class="abc-symptom__case-body"><?php echo wp_kses_post( $abc_case['body'] ); ?></p>
							</article>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>

				<?php $abc_case_url = abc_symptom_url( abc_symptom_get( $abc_links, 'case' ) ); ?>
				<?php if ( $abc_case_url ) : ?>
					<p class="abc-symptom__linkbox">
						<a class="abc-symptom__link-button" href="<?php echo esc_url( $abc_case_url ); ?>">
							<?php echo esc_html( abc_symptom_get( $abc_data, 'cases.link_label', '症例をもっと見る' ) ); ?>
						</a>
					</p>
				<?php endif; ?>

				<p class="abc-symptom__note">※効果の感じ方や必要な回数には個人差があります。</p>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ⑥ 専門性 ─ 姿勢改善ページへ
		 * ====================================================== */ ?>
		<?php if ( abc_symptom_get( $abc_data, 'expertise.heading' ) ) : ?>
		<section class="abc-symptom__section abc-symptom__section--expertise" id="expertise">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 6, '専門性' ); // phpcs:ignore ?>
					<?php echo esc_html( $abc_data['expertise']['heading'] ); ?>
				</h2>
				<?php foreach ( abc_symptom_get( $abc_data, 'expertise.body', array() ) as $abc_paragraph ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_paragraph ); ?></p>
				<?php endforeach; ?>

				<?php if ( abc_symptom_get( $abc_data, 'expertise.points', array() ) ) : ?>
					<ul class="abc-symptom__points">
						<?php foreach ( $abc_data['expertise']['points'] as $abc_point ) : ?>
							<li><?php echo esc_html( $abc_point ); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>

				<?php $abc_posture_url = abc_symptom_url( abc_symptom_get( $abc_links, 'posture' ) ); ?>
				<?php if ( $abc_posture_url ) : ?>
					<p class="abc-symptom__linkbox">
						<a class="abc-symptom__link-button" href="<?php echo esc_url( $abc_posture_url ); ?>">
							<?php echo esc_html( abc_symptom_get( $abc_data, 'expertise.link_label', '姿勢改善について詳しく見る' ) ); ?>
						</a>
					</p>
				<?php endif; ?>
			</div>
		</section>
		<?php endif; ?>

		<?php /* =========================================================
		 * ⑦ 行動 ─ 予約・LINE
		 * ====================================================== */ ?>
		<section class="abc-symptom__section abc-symptom__section--cta" id="reserve">
			<div class="abc-symptom__inner">
				<h2 class="abc-symptom__heading">
					<?php echo abc_symptom_step_label( 7, 'ご予約' ); // phpcs:ignore ?>
					<?php echo esc_html( abc_symptom_get( $abc_data, 'cta.heading', 'ご予約・ご相談' ) ); ?>
				</h2>
				<?php if ( abc_symptom_get( $abc_data, 'cta.lead' ) ) : ?>
					<p class="abc-symptom__text"><?php echo wp_kses_post( $abc_data['cta']['lead'] ); ?></p>
				<?php endif; ?>

				<?php if ( abc_symptom_get( $abc_cta, 'first_price' ) ) : ?>
					<p class="abc-symptom__price">
						<?php echo esc_html( $abc_cta['first_price'] ); ?>
						<?php if ( abc_symptom_get( $abc_cta, 'price_note' ) ) : ?>
							<span class="abc-symptom__price-note"><?php echo esc_html( $abc_cta['price_note'] ); ?></span>
						<?php endif; ?>
					</p>
				<?php endif; ?>

				<div class="abc-symptom__buttons">
					<?php if ( abc_symptom_get( $abc_cta, 'tel' ) ) : ?>
						<a class="abc-symptom__btn abc-symptom__btn--tel" href="<?php echo esc_attr( abc_symptom_tel_href( $abc_cta['tel'] ) ); ?>">
							<span class="abc-symptom__btn-label">電話で予約する</span>
							<span class="abc-symptom__btn-main"><?php echo esc_html( $abc_cta['tel'] ); ?></span>
							<span class="abc-symptom__btn-note"><?php echo esc_html( abc_symptom_get( $abc_cta, 'tel_note' ) ); ?></span>
						</a>
					<?php endif; ?>

					<?php if ( abc_symptom_get( $abc_cta, 'line_url' ) ) : ?>
						<a class="abc-symptom__btn abc-symptom__btn--line" href="<?php echo esc_url( abc_symptom_url( $abc_cta['line_url'] ) ); ?>" target="_blank" rel="noopener">
							<span class="abc-symptom__btn-label">LINEで予約・相談</span>
							<span class="abc-symptom__btn-main">LINEを開く</span>
							<span class="abc-symptom__btn-note"><?php echo esc_html( abc_symptom_get( $abc_cta, 'line_note' ) ); ?></span>
						</a>
					<?php endif; ?>

					<?php if ( abc_symptom_get( $abc_cta, 'web_url' ) ) : ?>
						<a class="abc-symptom__btn abc-symptom__btn--web" href="<?php echo esc_url( abc_symptom_url( $abc_cta['web_url'] ) ); ?>">
							<span class="abc-symptom__btn-label">Webで予約する</span>
							<span class="abc-symptom__btn-main">予約フォームへ</span>
							<span class="abc-symptom__btn-note"><?php echo esc_html( abc_symptom_get( $abc_cta, 'web_note' ) ); ?></span>
						</a>
					<?php endif; ?>
				</div>

				<?php if ( abc_symptom_get( $abc_clinic, 'address' ) || abc_symptom_get( $abc_clinic, 'hours' ) ) : ?>
					<dl class="abc-symptom__info">
						<?php if ( abc_symptom_get( $abc_clinic, 'name' ) ) : ?>
							<div><dt>院名</dt><dd><?php echo esc_html( $abc_clinic['name'] ); ?></dd></div>
						<?php endif; ?>
						<?php if ( abc_symptom_get( $abc_clinic, 'address' ) ) : ?>
							<div><dt>住所</dt><dd><?php echo esc_html( $abc_clinic['address'] ); ?></dd></div>
						<?php endif; ?>
						<?php if ( abc_symptom_get( $abc_clinic, 'access' ) ) : ?>
							<div><dt>アクセス</dt><dd><?php echo esc_html( $abc_clinic['access'] ); ?></dd></div>
						<?php endif; ?>
						<?php if ( abc_symptom_get( $abc_clinic, 'hours' ) ) : ?>
							<div><dt>受付時間</dt><dd><?php echo esc_html( $abc_clinic['hours'] ); ?></dd></div>
						<?php endif; ?>
						<?php if ( abc_symptom_get( $abc_clinic, 'holiday' ) ) : ?>
							<div><dt>休診日</dt><dd><?php echo esc_html( $abc_clinic['holiday'] ); ?></dd></div>
						<?php endif; ?>
					</dl>
				<?php endif; ?>
			</div>
		</section>

		<?php if ( abc_symptom_get( $abc_config, 'disclaimer' ) ) : ?>
			<p class="abc-symptom__disclaimer">
				<span class="abc-symptom__inner"><?php echo esc_html( $abc_config['disclaimer'] ); ?></span>
			</p>
		<?php endif; ?>

	</main>

<?php endif; ?>

<?php
get_footer();
