import Table from "./Table"

const Board = () => {
	return (
		<div className="flex flex-row">
			<Table id="resident"/>
			<Table id="corporate"/>
		</div>
  )
}

export default Board