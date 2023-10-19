import { useEffect, useState } from "react"
import Table, { Role } from "./Table"
import { Toaster, toast } from 'react-hot-toast';

const RIVER_DEPTH = 10;
const MAX_RAIN = 12;

const Board = () => {
	const [resetFlag, setResetFlag] = useState(0)
	const [nextFlag, setNextFlag] = useState(0)
	const [flood, setFlood] = useState({ round: 0, level: 0 })
	const [sediment, setSediment] = useState(JSON.parse(localStorage.getItem("sediment"))?.sediment ?? 0)
	const [sediment1, setSediment1] = useState(-1)
	const [sediment2, setSediment2] = useState(-1)

	useEffect(() => {
    localStorage.setItem("sediment", JSON.stringify({ sediment: sediment }))
  }, [sediment])

	const addSediment = (value) => {
		if (sediment + value > RIVER_DEPTH * 10) {
			setSediment(RIVER_DEPTH * 10)
			return
		}
		setSediment(sediment + value)
	}

	const removeSediment = (value) => {
		setSediment(sediment - value)
	}

	useEffect(() => {
		if (sediment1 > -1 && sediment2 > -1) {
			addSediment(sediment1+sediment2)
			setSediment1(-1)
			setSediment2(-1)
		}
	},[sediment1, sediment2])

	const restart = () => {
		localStorage.removeItem('resident')
		localStorage.removeItem('corporate')
		setResetFlag(resetFlag + 1)
		setNextFlag(0)
		setSediment(0)
		toast.success('New Game!', {
			position: "bottom-center"
		})
	}

	const getFloodLevel = () => {
		const rainLevel = Math.floor(Math.random() * MAX_RAIN)
		const sedimentLevel = Math.floor(sediment / 10)
		const floodLevel = sedimentLevel + rainLevel - RIVER_DEPTH
		return floodLevel > 10 ? 10 : floodLevel < 0 ? 0 : floodLevel
	}

	const next = () => {
		const temp = nextFlag
		setNextFlag(temp + 1)
		const floodLevel = getFloodLevel()
		setFlood({ round: temp + 1, level: floodLevel })
		if (floodLevel > 0) {
			toast.error(`There was a flood of level ${floodLevel}`, {
				position: "bottom-center"
			})
		} else {
			toast.success('There was no flood', {
				position: "bottom-center"
			})
		}
	}

	return (
		<div className="flex flex-col items-start">
			<div className="flex flex-row flex-shrink-0">
				<Table id="resident" isRotated={true} title="Residential Area" role={Role.RESIDENTS} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} addSediment={setSediment1} />
				<Table id="corporate" isRotated={false} title="Industrial Area" role={Role.COMPANIES} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} addSediment={setSediment2} />
			</div>
			<p className="mt-20">{`Sediment Level: ${Math.floor(sediment/10)}`}</p>
			<div className="flex justify-between mt-20 gap-20">
				<button className="btn bg-red-300" onClick={restart}>Reset Game</button>
				<button className="btn bg-green-300" onClick={next}>Next Round</button>
			</div>
			<Toaster />
		</div>
	)
}

export default Board