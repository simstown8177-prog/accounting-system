from __future__ import annotations

CATEGORY_RULES: dict[str, tuple[str, ...]] = {
    "식비": ("마트", "편의점", "배달", "식당", "카페", "coffee", "restaurant", "burger", "pizza"),
    "교통": ("지하철", "버스", "택시", "주유", "주차", "tmap", "kakao t", "srt", "ktx"),
    "주거/공과금": ("관리비", "전기", "수도", "가스", "월세", "임대", "아파트", "도시가스"),
    "통신": ("kt", "skt", "lg u+", "통신", "인터넷", "휴대폰", "phone", "mobile"),
    "의료": ("병원", "약국", "의원", "치과", "한의원", "medical", "clinic"),
    "보험": ("보험", "insurance"),
    "교육": ("학원", "교육", "교재", "수강", "udemy", "class", "course"),
    "쇼핑": ("쿠팡", "네이버", "11번가", "gmarket", "amazon", "store", "shopping"),
    "금융": ("이자", "대출", "카드대금", "수수료", "fee", "interest", "loan"),
    "급여": ("급여", "salary", "payroll", "상여"),
    "카드대금": ("카드결제", "카드대금", "card payment"),
    "부채상환": ("할부원금", "부채상환"),
    "이체": ("이체", "송금", "transfer", "입금", "출금"),
}


def categorize(description: str, amount: float) -> str:
    text = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword.lower() in text for keyword in keywords):
            return category
    return "수입" if amount > 0 else "기타지출"
