<!DOCTYPE html>
<html lang="ru">
<?php
// header('Content-Type: text/html; charset=utf-8');
?>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Заполните форму КП</title>
	<link rel="icon" type="image/png" href="/img/icon.png"/>
	<link rel="manifest" href="/manifest.webmanifest">
	<link rel="stylesheet" href="style/bootstrap/css/bootstrap.min.css">
	<link rel="stylesheet" href="style/style.css">
	<script src="style/jquery/jquery-3.3.1.min.js"></script>
	<script async src="style/bootstrap/js/bootstrap.min.js"></script>
	<script src="localStorageDB.js"></script>
</head>

<body>
	<script>
		const needUpd = JSON.parse(localStorage.getItem('needUpd')) ?? true
		if (needUpd)
			clearData()

		var curProject = {
				chooseManager: '',
				client: '',
				clientName: '',
				clientSex: 'm',
				linkToItems: '',
				mainCurChoose: 'rub',
				extraCurChoose: 'rub',
				euroRate: '',
				cacheMainTable: '',
				mainCounter: 0,
				extraCounter: 0,
				cacheExtraTable: '',
				comment: 'да',
				commentCount: 0,
				cacheCommentWrapper: '',
			}

		function cacheMake( key, value ) {
			if (key)
				curProject[key] = value

			if (curProjectName)
				saveProject()
		}
		function clearData() {
			localStorage.clear()
			obj_db.clear()
			if (needUpd)
				localStorage.setItem('needUpd', !needUpd)
			setTimeout(() => {
				location.reload()
			})
		}

		function replaceComma(elem) {
			if (elem.value.indexOf(',') !== -1)
				elem.value = elem.value.replace(',', '.')
		}

		function showMainButtons(elem) {
			var buttons = document.getElementsByClassName('main_button');

			if (elem.value == 'michael_smu.jpg') {
				buttons[0].hidden = false;
			} else {
				buttons[0].hidden = true;
			}
		}
	</script>

	<div class="container p-0">
		<button
			onclick="clearData()"
			class="button--clear-data"
			style="
				position: fixed;
				top: 100px;
				right: calc(50% - 145mm);
				padding: 10px;
				border: 0;
				border-radius: 15px;
				cursor: pointer;
				z-index: 100;
			"
		>
			Очистить данные
		</button>

		<button
			onclick="window.open(
				'/managers/add_manager.php',
				'Добавить менеджера',
				'left=400, top=300 ,width=500 ,height=300 ,menubar=no ,toolbar=no ,location=no, status=no, resizable=yes, scrollbars=yes'
			)"
			class="main_button"
			style="
				position: absolute;
				top: 200px;
				left: -20%;
				padding: 10px;
				border: 0;
				border-radius: 15px;
				cursor: pointer;
				z-index: 100;
			"
			hidden
		>
			Добавить / Удалить <br> менеджера
		</button>

		<header class="header">
			<div class="divHeader">
				<img class="header_img" src="style/header.jpg">
			</div>
		</header>

		<main class="content">
			<form id="KP" action="result.php" enctype="multipart/form-data" method="post">
				<h1>Заполни форму:</h1>
				<input type="hidden" name="maxFileSize" value="30000">

				<fieldset class="projects_list">
					<legend>Выбери проект:</legend>
					<input class="projects_search" type="search" placeholder="Поиск по проектам" oninput="findProject(this.value)">
					<div id="projects"></div>
				</fieldset>

				<script>
					var existProjects = document.getElementById('projects'),
							curProjectName = localStorage.getItem('curProjectName') ?? '',
							projectsList = JSON.parse(localStorage.getItem('projectsList')) ?? {},
							readyProjects = {}

					if (curProjectName)
						curProject = projectsList[curProjectName]

					function createProject(value) {
						saveProject()
						curProjectName = value
						cacheMake('client', value)
					}
					function saveProject() {
						if (curProjectName) {
							curProjectName = curProject.client
							projectsList[curProjectName] = {...curProject}
							localStorage.setItem('curProjectName', curProjectName)
							localStorage.setItem('projectsList', JSON.stringify(projectsList))
						}
					}
					function deleteProject(key) {
						if (projectsList[key])
							delete projectsList[key]
						if (readyProjects[key])
							readyProjects[key].remove()

						saveProject()
					}
					function setProject() {
						Object.entries(projectsList).forEach(([key, content]) => {
							const newProject = document.createElement('label')
							newProject.className = 'projects_list-item'
							newProject.innerHTML = `
								<span
									class="deleteProject('${key}')"
									style="color: #fff;"
								>
									&mdash;
								</span>
								&nbsp;
								<input
									onclick="chooseProject('${key}')"
									name="project"
									value="${content.client}"
									type="radio"
									${key == curProjectName ? 'checked' : ''}
								>
								&nbsp;
								${content.client}
								<hr>
							`
							existProjects.append(newProject)
							readyProjects[key] = newProject
						})
					}
					function chooseProject(key) {
						saveProject()
						localStorage.setItem('curProjectName', key)
						location.reload()
					}
					function findProject(search) {
						if (!search)
							return Object.values(readyProjects).forEach(node => node.style.display = 'block')

						Object.entries(readyProjects).forEach(([project, node]) => {
							if (project.toLowerCase().includes(search.toLowerCase()))
								node.style.display = 'block'
							else
								node.style.display = 'none'
						})
					}

					document.addEventListener('DOMContentLoaded', setProject)
				</script>

				<fieldset>
					<legend>Выбрать ФИО менеджера</legend>
					<?php include 'managers/managers.htm';?>
				</fieldset>

				<br>

				<label>
					Название компании, с которой работаете:
					<input
						name="client"
						id="client"
						class="beginingForm"
						placeholder="Название компании или ИП"
						onchange="createProject(this.value)"
						onfocus="select(this)"
						type="text"
					>
				</label>

				<label>
					Имя контактного лица:
					<input
						name="clientName"
						id="clientName"
						class="beginingForm"
						placeholder="Имя контактного лица"
						onchange="cacheMake(this.name, this.value);"
						onfocus="select(this)"
						type="text"
					>
				</label>

				<br>

				<label>Пол контактного лица:</label>
				<label>
					<input
						name="clientSex"
						onchange="cacheMake(this.name, this.value);"
						onfocus="select(this)"
						value="m"
						checked
						type="radio"
					>
					Муж.
				</label>

				<label>
					<input
						name="clientSex"
						onchange="cacheMake(this.name, this.value);"
						onfocus="select(this)"
						value="f"
						type="radio"
					>
					Жен.
				</label>

				<br>

				<label>
					Ссылка на коллекцию на сайте:
					<input
						name="linkToItems"
						id="linkToItems"
						class="beginingForm"
						placeholder="Ссылка на страницу на сайте"
						onchange="cacheMake(this.name, this.value);"
						onfocus="select(this)"
						type="url"
					>
				</label>

				<br>

				<label>
					Введите текущий курс евро:
					<input
						name="euroRate"
						id="euroRate"
						class="beginingForm"
						placeholder="Введите текущий курс евро"
						onchange="cacheMake(this.name, this.value);"
						onfocus="select(this)"
						type="text"
					>
					<button
						onclick="setCurrencyToField()"
						type="button"
						title="Значение по курсу ЦБ"
					>ЦБ</button>
				</label>

				<br>

				<fieldset>
					<legend>Выберите валюту основных материалов:</legend>
					<label><input name="mainCurChoose" value="rub" class="" onchange="cacheMake(this.name, this.value);" type="radio" checked>&nbsp;Рубли</label><br>
					<label><input name="mainCurChoose" value="rubAndEuro" class="" onchange="cacheMake(this.name, this.value);" type="radio">&nbsp;Рубли и Евро</label>
				</fieldset>

				<fieldset>
					<legend>Выберите валюту дополнительных материалов:</legend>
					<label><input name="extraCurChoose" value="rub" class="" onchange="cacheMake(this.name, this.value);" type="radio" checked>&nbsp;Рубли</label><br>
					<label><input name="extraCurChoose" value="rubAndEuro" class="" onchange="cacheMake(this.name, this.value);" type="radio">&nbsp;Рубли и Евро</label>
				</fieldset>

				<fieldset style="margin-bottom: 20px;">
					<legend>Какие основные материалы:</legend>

					<div
						id="mainPositions"
						style="position: relative;"
					></div>

					<input
						onclick="addMainPosition()"
						title="Добавить позицию"
						value="+"
						type="button"
						style="
							width: 30px;
							padding: 5px 3px;
							font-size: 30px;
							line-height: 15px;
							vertical-align: top;
						"
					>
				</fieldset>

				<script>
					var mainCounter = 1

					if (localStorage.getItem('mainCounter'))
						mainCounter = parseInt(localStorage.getItem('mainCounter'))

					function saveSelectedOption(elem) {
						const options = [...elem.options]
						options.forEach(option => {
							if (option.value === elem.value)
								option.setAttribute('selected', true)
							else
								option.removeAttribute('selected')
						})
					}
					function createMainPositionsTemplate(index) {
						const inputRow = `
							<input
								onclick="insertMainPosition(${index + 1})"
								title="Добавить позицию"
								value="+"
								type="button"
								id="btnInsertItem"
								style="
									padding: 5px 3px;
									font-size: 30px;
									line-height: 15px;
									vertical-align: top;
									position: absolute;
									top: 0;
									left: -65px;
									width: 30px;
								"
							>
							<input
								onclick="delMainPosition(${index})"
								title="Удалить позицию"
								value="&ndash;"
								type="button"
								id="btnDeleteItem"
								style="
									padding: 5px 3px;
									font-size: 30px;
									line-height: 15px;
									vertical-align: top;
									position: absolute;
									top: 0;
									left: -35px;
									width: 30px;
								"
							>

							<label>
								<input
									name="mainMaterial[${index}][]"
									value="${index + 1}."
									readonly
									class="list-counter"
									type="text"
								>
							</label>

							<label>
								<input
									name="mainMaterial[${index}][]"
									onchange="this.setAttribute('value', this.value); cacheMake('cacheMainTable', cacheMainTable.innerHTML);"
									placeholder="Наименование"
									class="list-name"
									type="text"
								>
							</label>

							<label>
								<input
									name="mainMaterial[${index}][]"
									onchange="replaceComma(this); this.setAttribute('value', this.value); cacheMake('cacheMainTable', cacheMainTable.innerHTML);"
									placeholder="Кол-во"
									class="list-number"
									type="text"
								>
							</label>

							<label>
								<select
									name="mainMaterial[${index}][]"
									onchange="saveSelectedOption(this); cacheMake('cacheMainTable', cacheMainTable.innerHTML);"
								>
									<option value="шт.">шт.</option>
									<option value="м&sup2;" selected>м&sup2;</option>
									<option value="пог.м">пог.м</option>
								</select>
							</label>

							<label>
								<input
									name="mainMaterial[${index}][]"
									onchange="replaceComma(this); this.setAttribute('value', this.value); cacheMake('cacheMainTable', cacheMainTable.innerHTML);"
									title="Стоимость указывать в рублях даже в случае выбора пункта &#34;Рубли и евро&#34;"
									placeholder="Цена в рублях"
									class="list-price"
									type="text"
								>
							</label>
						`

						const inputRowWrapper = document.createElement('div')
						inputRowWrapper.id = `mainBlockItem${index}`
						inputRowWrapper.style.position = 'relative'
						inputRowWrapper.innerHTML = inputRow

						return inputRowWrapper
					}
					function addMainPosition() {
						const inputRowWrapper = createMainPositionsTemplate(mainCounter)
						document.body.querySelector('#mainPositions')?.append(inputRowWrapper)

						++mainCounter
						cacheMake('mainCounter', mainCounter)
						cacheMake('cacheMainTable', cacheMainTable.innerHTML)
					}
					function delMainPosition(index) {
						if (!mainCounter)
							++mainCounter

						document.querySelector(`#mainBlockItem${index}`)?.remove()

						const mainBlockItemList = [...document.body.querySelectorAll('[id*="mainBlockItem"]')]
						mainBlockItemList.forEach((node, i) => {
							const btnInsert = node.querySelector('#btnInsertItem')
							const btnDelete = node.querySelector('#btnDeleteItem')
							const inputList = [...node.querySelectorAll('[name*="mainMaterial"]')]

							node.setAttribute('id', `mainBlockItem${i}`)
							btnInsert.setAttribute('onclick', `insertMainPosition(${i + 1})`)
							btnDelete.setAttribute('onclick', `delMainPosition(${i})`)
							inputList.forEach((input, ind) => {
								if (!ind)
									input.setAttribute('value', `${i + 1}.`)
								input.setAttribute('name', `mainMaterial[${i}][]`)
							})
						})

						--mainCounter
						cacheMake('mainCounter', mainCounter)
						cacheMake('cacheMainTable', cacheMainTable.innerHTML)
					}
					function insertMainPosition(index) {
						const inputRowWrapper = createMainPositionsTemplate(+index)

						if (mainCounter > index)
							for (let i = mainCounter; i > index; i--) {
								const node = cacheMainTable.querySelector(`#mainBlockItem${i - 1}`)
								const btnInsert = node.querySelector('#btnInsertItem')
								const btnDelete = node.querySelector('#btnDeleteItem')
								const inputList = [...node.querySelectorAll('[name*="mainMaterial"]')]
								node.setAttribute('id', `mainBlockItem${i}`)
								btnInsert.setAttribute('onclick', `insertMainPosition(${i + 1})`)
								btnDelete.setAttribute('onclick', `delMainPosition(${i})`)
								inputList.forEach((input, ind) => {
									if (!ind)
										input.setAttribute('value', `${i + 1}.`)
									input.setAttribute('name', `mainMaterial[${i}][]`)
								})
							}

							cacheMainTable.querySelector(`#mainBlockItem${index - 1}`)?.after(inputRowWrapper)

						++mainCounter
						cacheMake('mainCounter', mainCounter)
						cacheMake('cacheMainTable', cacheMainTable.innerHTML)
					}
				</script>

				<fieldset style="margin-bottom: 20px;">
					<legend>Какие дополнительные материалы и работы:</legend>

					<div
						id="extraPositions"
						style="position: relative;"
					></div>

					<input
						onclick="addExtraPosition()"
						title="Добавить позицию"
						value="+"
						type="button"
						style="
							width: 30px;
							padding: 5px 3px;
							font-size: 30px;
							line-height: 15px;
							vertical-align: top;
						"
					>
				</fieldset>

				<script>
					var extraCounter = 1

					if (localStorage.getItem('extraCounter')) {
						extraCounter = parseInt(localStorage.getItem('extraCounter'));
					}

					function createExtraPositionsTemplate(index) {
						const inputRow = `
							<input
								onclick="insertExtraPosition(${index + 1})"
								title="Добавить позицию"
								value="+"
								type="button"
								id="btnInsertItem"
								style="
									padding: 5px 3px;
									font-size: 30px;
									line-height: 15px;
									vertical-align: top;
									position: absolute;
									top: 0;
									left: -65px;
									width: 30px;
								"
							>
							<input
								onclick="delExtraPosition(${index})"
								title="Удалить позицию"
								value="&ndash;"
								type="button"
								id="btnDeleteItem"
								style="
									padding: 5px 3px;
									font-size: 30px;
									line-height: 15px;
									vertical-align: top;
									position: absolute;
									top: 0;
									left: -35px;
									width: 30px;
								"
							>

							<label>
								<input
									name="additionalMaterial[${index}][]"
									value="${index + 1}."
									readonly
									class="list-counter"
									type="text"
								>
							</label>

							<label>
								<input
									name="additionalMaterial[${index}][]"
									onchange="this.setAttribute('value', this.value); cacheMake('cacheExtraTable', cacheExtraTable.innerHTML);"
									placeholder="Наименование"
									class="list-name"
									type="text"
								>
							</label>

							<label>
								<input
									name="additionalMaterial[${index}][]"
									onchange="replaceComma(this); this.setAttribute('value', this.value); cacheMake('cacheExtraTable', cacheExtraTable.innerHTML);"
									placeholder="Кол-во"
									class="list-number"
									type="text"
								>
							</label>

							<label>
								<select
									name="additionalMaterial[${index}][]"
									onchange="saveSelectedOption(this); cacheMake('cacheExtraTable', cacheExtraTable.innerHTML);"
								>
									<option value="шт.">шт.</option>
									<option value="м&sup2;" selected>м&sup2;</option>
									<option value="пог.м">пог.м</option>
								</select>
							</label>

							<label>
								<input
									name="additionalMaterial[${index}][]"
									onchange="replaceComma(this); this.setAttribute('value', this.value); cacheMake('cacheExtraTable', cacheExtraTable.innerHTML);"
									title="Стоимость указывать в рублях даже в случае выбора пункта &#34;Рубли и евро&#34;"
									placeholder="Цена в рублях"
									class="list-price"
									type="text"
								>
							</label>
						`

						const inputRowWrapper = document.createElement('div')
						inputRowWrapper.id = `extraBlockItem${index}`
						inputRowWrapper.style.position = 'relative'
						inputRowWrapper.innerHTML = inputRow

						return inputRowWrapper
					}
					function addExtraPosition() {
						const inputRowWrapper = createExtraPositionsTemplate(extraCounter)
						document.body.querySelector('#extraPositions')?.append(inputRowWrapper)

						++extraCounter
						cacheMake('extraCounter', extraCounter)
						cacheMake('cacheExtraTable', cacheExtraTable.innerHTML)
					}
					function delExtraPosition(index) {
						if (!extraCounter)
							++extraCounter

						document.querySelector(`#extraBlockItem${index}`)?.remove()

						const extraBlockItemList = [...document.body.querySelectorAll('[id*="extraBlockItem"]')]
						extraBlockItemList.forEach((node, i) => {
							const btnInsert = node.querySelector('#btnInsertItem')
							const btnDelete = node.querySelector('#btnDeleteItem')
							const inputList = [...node.querySelectorAll('[name*="additionalMaterial"]')]

							node.setAttribute('id', `extraBlockItem${i}`)
							btnInsert.setAttribute('onclick', `insertExtraPosition(${i + 1})`)
							btnDelete.setAttribute('onclick', `delExtraPosition(${i})`)
							inputList.forEach((input, ind) => {
								if (!ind)
									input.setAttribute('value', `${i + 1}.`)
								input.setAttribute('name', `additionalMaterial[${i}][]`)
							})
						})

						--extraCounter
						cacheMake('extraCounter', extraCounter)
						cacheMake('cacheExtraTable', cacheExtraTable.innerHTML)
					}
					function insertExtraPosition(index) {
						const inputRowWrapper = createExtraPositionsTemplate(+index)

						if (extraCounter > index)
							for (let i = extraCounter; i > index; i--) {
								const node = cacheExtraTable.querySelector(`#extraBlockItem${i - 1}`)
								const btnInsert = node.querySelector('#btnInsertItem')
								const btnDelete = node.querySelector('#btnDeleteItem')
								const inputList = [...node.querySelectorAll('[name*="additionalMaterial"]')]
								node.setAttribute('id', `extraBlockItem${i}`)
								btnInsert.setAttribute('onclick', `insertExtraPosition(${i + 1})`)
								btnDelete.setAttribute('onclick', `delExtraPosition(${i})`)
								inputList.forEach((input, ind) => {
									if (!ind)
										input.setAttribute('value', `${i + 1}.`)
									input.setAttribute('name', `additionalMaterial[${i}][]`)
								})
							}

							cacheExtraTable.querySelector(`#extraBlockItem${index - 1}`)?.after(inputRowWrapper)

						++extraCounter
						cacheMake('extraCounter', extraCounter)
						cacheMake('cacheExtraTable', cacheExtraTable.innerHTML)
					}
				</script>

				<fieldset class="comment_area">
					<legend>Комментарий по доставке</legend>

					<label>
						<input
							name="comment"
							onchange="cacheMake(this.name, this.value)"
							value="да"
							checked
							type="radio"
						>
						Доставка рассчитывается отдельно
					</label>

					<br>

					<label>
						<input
							name="comment"
							onchange="cacheMake(this.name, this.value)"
							value="нет"
							type="radio"
						>
						Нет комментария
					</label>

					<br>

					<label>
						<input
							name="comment"
							onchange="cacheMake(this.name, this.value)"
							value="свой"
							type="radio"
						>
						Другой комментарий(ии):
					</label>

					<br>

					<div id="commentWrapper">
						<div
							id="commentItem1"
							style="position: relative;"
						>
							<input
								onclick="delComment(0)"
								value="&ndash;"
								title="Удалить позицию"
								style="
									width: 30px;
									padding: 5px 3px;
									position: absolute;
									top: 0;
									left: -50px;
									font-size: 30px;
									line-height: 15px;
									vertical-align: top;
								"
								type="button"
							>

							<label>
								<span>&mdash;&nbsp;</span>
								<input
									name="commentText[0]"
									onchange="this.setAttribute('value', this.value); cacheMake('cacheCommentWrapper', cacheCommentWrapper.innerHTML);"
									class="comment-text"
									type="text"
								>
							</label>
						</div>
					</div>

					<input
						onclick="addComment()"
						value="+"
						title="Добавить позицию"
						style="
							width: 30px;
							padding: 5px 3px;
							font-size: 30px;
							line-height: 15px;
							vertical-align: top;
						"
						type="button"
					>
				</fieldset>

				<br>

				<input
					onclick="cacheMake(); saveProject();"
					value="Создать КП"
					type="submit"
					style="
						padding: 5px;
						border-radius: 10px;
					"
				>
			</form>
		</main>

		<footer class="footer">
			<div class="divFooter">
				<img class="footer_img" src="style/footer.jpg">
			</div>
		</footer>
	</div>

	<script>
		async function fetchCBCurrency() {
			const request = await fetch('/currency.php', {
				method: 'GET',
				mode: 'no-cors',
			})
			const xmlStr = await request.text()
			const xmlParser = new DOMParser()
			const oDOM = xmlParser.parseFromString(xmlStr, 'application/xml')
			const currencyList = [...oDOM.querySelectorAll('Valute')]
			const usd = currencyList.find(el => el.querySelector('CharCode').innerHTML === 'USD')
			const eur = currencyList.find(el => el.querySelector('CharCode').innerHTML === 'EUR')
			const usdValue = usd.querySelector('Value').innerHTML
			const eurValue = eur.querySelector('Value').innerHTML
			return {
				usd: usdValue,
				eur: eurValue,
			}
		}
		async function setCurrencyToField() {
			const currencies = await fetchCBCurrency()
			const eurField = document.body.querySelector('#euroRate')
			if (eurField)
				eurField.value = currencies.eur

			cacheMake('euroRate', currencies.eur)
		}

		var commentCount = 1
		if (localStorage.getItem('commentCount'))
			commentCount = localStorage.getItem('commentCount')

		function addComment() {
			const newCommentRow = `
				<input
					onclick="delComment(${commentCount})"
					value="&ndash;"
					title="Удалить позицию"
					style="
						width: 30px;
						padding: 5px 3px;
						position: absolute;
						top: 0;
						left: -50px;
						font-size: 30px;
						line-height: 15px;
						vertical-align: top;
					"
					type="button"
				>

				<label>
					<span>&mdash;&nbsp;</span>
					<input
						name="commentText[${commentCount}]"
						onchange="this.setAttribute('value', this.value); cacheMake('cacheCommentWrapper', cacheCommentWrapper.innerHTML);"
						class="comment-text"
						type="text"
					>
				</label>
			`
			const wrapper = document.createElement('div')
			wrapper.id = `commentItem${commentCount + 1}`
			wrapper.style.position = 'relative'
			wrapper.innerHTML = newCommentRow

			document.body.querySelector('#commentWrapper')?.append(wrapper)

			++commentCount
			cacheMake('commentCount', commentCount)
			cacheMake('cacheCommentWrapper', cacheCommentWrapper.innerHTML)
		}
		function delComment(index) {
			if (!commentCount)
				++commentCount

			document.querySelector(`#commentItem${index + 1}`)?.remove()

			const itemList = [...document.body.querySelectorAll('[id*="commentItem"]')]
			itemList.forEach((node, i) => {
				const btn = node.querySelector('[type="button"]')
				const input = node.querySelector('[type="text"]')

				btn.setAttribute('onclick', `delComment(${i})`)
				input.setAttribute('name', `commentText[${i}]`)
				node.setAttribute('id', `commentItem${i + 1}`)
			})

			--commentCount
			cacheMake('commentCount', commentCount)
			cacheMake('cacheCommentWrapper', cacheCommentWrapper.innerHTML)
		}

		var cacheManager = document.getElementsByName('chooseManager'),
				cacheFormInput = document.getElementsByClassName('beginingForm'),
				cacheClientSex = document.getElementsByName('clientSex'),
				mainCurChoose = document.getElementsByName('mainCurChoose'),
				extraCurChoose = document.getElementsByName('extraCurChoose'),
				cacheMainTable = document.getElementById('mainPositions'),
				cacheExtraTable = document.getElementById('extraPositions'),
				comment = document.getElementsByName('comment'),
				cacheCommentWrapper = document.getElementById('commentWrapper')

		document.addEventListener('DOMContentLoaded', () => {
			cacheManager[0].value = curProject.chooseManager;
			document.querySelector('.footer_img').src = curProject?.chooseManager
				? 'managers/' + curProject?.chooseManager
				: 'style/footer.jpg';
			[...cacheFormInput].forEach(node => node.value = curProject[node.name]);
			[...cacheClientSex].forEach(node => {
				if (node.value === curProject.clientSex)
					node.checked = true
			});
			[...mainCurChoose].forEach(node => {
				if (node.value === curProject.mainCurChoose)
					node.checked = true
			});
			[...extraCurChoose].forEach(node => {
				if (node.value === curProject.extraCurChoose)
					node.checked = true
			});
			[...comment].forEach(node => {
				if (node.value === curProject.comment)
					node.checked = true
			});
			cacheMainTable.innerHTML = curProject.cacheMainTable;
			cacheExtraTable.innerHTML = curProject.cacheExtraTable;
			cacheCommentWrapper.innerHTML = curProject.cacheCommentWrapper;
			commentCount = curProject.commentCount;
			extraCounter = curProject.extraCounter;
			mainCounter = curProject.mainCounter;
		})

		showMainButtons(document.getElementsByName('chooseManager')[0])
	</script>
</body>

</html>