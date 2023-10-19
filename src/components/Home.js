import { FaHome } from "react-icons/fa";

const Home = ({ onClick, disabled = false }) => {
  return (
    <button className="bg-yellow-300 w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}>
      <FaHome />
    </button>
  )
}

export default Home